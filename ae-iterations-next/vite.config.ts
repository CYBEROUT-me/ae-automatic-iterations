import { defineConfig, type Plugin } from "vite";

import react from "@vitejs/plugin-react";

import { cep, CepOptions, runAction } from "vite-cep-plugin";
import cepConfig from "./cep.config";
import path from "path";
import fs from "fs";
import { extendscriptConfig } from "./vite.es.config";

const extensions = [".js", ".ts", ".tsx"];

const devDist = "dist";
const cepDist = "cep";

const src = path.resolve(__dirname, "src");
const root = path.resolve(src, "js");
const outDir = path.resolve(__dirname, "dist", cepDist);

const debugReact = process.env.DEBUG_REACT === "true";
const isProduction = process.env.NODE_ENV === "production";
const isMetaPackage = process.env.ZIP_PACKAGE === "true";
const isPackage = process.env.ZXP_PACKAGE === "true" || isMetaPackage;
const isServe = process.env.SERVE_PANEL === "true";
const action = process.env.BOLT_ACTION;

let input: { [key: string]: string } = {};
cepConfig.panels.map((panel) => {
  input[panel.name] = path.resolve(root, panel.mainPath);
});

const config: CepOptions = {
  cepConfig,
  isProduction,
  isPackage,
  isMetaPackage,
  isServe,
  debugReact,
  dir: `${__dirname}/${devDist}`,
  cepDist: cepDist,
  zxpOutput: `${__dirname}/${devDist}/zxp/${cepConfig.id}`,
  zipOutput: `${__dirname}/${devDist}/zip/${cepConfig.displayName}_${cepConfig.version}`,
  packages: cepConfig.installModules || [],
};

if (action) runAction(config, action);

// extension/emojis/ (558MB, 166 files) is the single source of truth for
// emoji assets and must never be copied/moved/symlinked into this project.
// Vite's built-in `publicDir` copies a directory's *contents* flat into the
// root of `outDir` (see copyDir() in vite's build pipeline) -- it does not
// preserve the source folder's own name, so pointing `publicDir` directly at
// extension/emojis/ dumps 166 loose files into dist/cep/ instead of nesting
// them under dist/cep/emojis/ (confirmed by a local build: files landed at
// dist/cep/*.gif, not dist/cep/emojis/*.gif). vite-cep-plugin's own
// `copyAssets` mechanism (cep.config.ts) can't be used either -- it resolves
// both the source and destination from the *same* relative asset string
// rooted at src/, so a "../../extension/emojis" entry would cancel out the
// dest prefix and copy to the wrong place. Instead, this plugin copies the
// folder verbatim into `${outDir}/emojis` so aeft.ts's listEmojiFiles() finds
// it at a predictable path (dist/cep/emojis/, sibling to dist/cep/jsx/).
//
// This runs in `generateBundle`, not `closeBundle`. `generateBundle` is a
// sequential Rollup hook: Rollup guarantees every plugin's `generateBundle`
// finishes before any plugin's `writeBundle` hook starts. vite-cep-plugin's
// zxp-signing step runs inside its own `writeBundle` hook, so `generateBundle`
// is the last point at which we're guaranteed to run before signing reads
// the output directory. `closeBundle` fires strictly after `writeBundle`
// (Rollup awaits all `writeBundle` hooks, including signing, before calling
// any `closeBundle` hook) -- by then the .zxp has already been sealed
// without the emoji folder, which was the original bug being fixed here.
const emojiSrcDir = path.resolve(__dirname, "../extension/emojis");
const copyEmojisPlugin = (): Plugin => ({
  name: "copy-emojis-dir",
  generateBundle() {
    if (fs.existsSync(emojiSrcDir)) {
      fs.cpSync(emojiSrcDir, path.join(outDir, "emojis"), { recursive: true });
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    cep(config),
    copyEmojisPlugin(),
  ],
  // Dev-server only. userPresets.ts and fonts.ts read `process.platform`/
  // `process.env` as default-parameter values (so callers can override them
  // in tests) so they resolve correctly per-OS when this project's code
  // actually runs inside CEP's real Node integration (--enable-nodejs). Vite's
  // dev server has no Node runtime backing it at all, so the bare identifier
  // `process` doesn't exist there -- calling fontDirectories()/
  // userPresetsPath() with no args (their real call sites: LayerInfoPanel's
  // mount effect calls loadFonts() -> fontDirectories() unconditionally, and
  // PresetPanel's initial state calls loadUserPresets() -> userPresetsPath())
  // throws `process is not defined`. loadFonts() throws from inside a
  // useEffect with no error boundary above it, and React 19's default
  // recovery for an uncaught passive-effect error with no boundary is to
  // unmount the whole tree -- which is why the panel painted nothing at all,
  // even though the initial render before the effect ran had actually
  // succeeded (confirmed by manually re-rendering LayerInfoPanel in isolation
  // with an onUncaughtError hook wired up, which caught this exact error).
  // `define` performs literal text substitution at transform time, so these
  // two expressions never reach the browser as the bare identifier `process`
  // -- scoped to `command === "serve"` because the production build must
  // keep detecting the real OS dynamically via the genuine Node `process`
  // global CEP's Node integration provides; baking in the *build machine's*
  // platform would silently break Windows users.
  define:
    command === "serve"
      ? { "process.env": {}, "process.platform": JSON.stringify(process.platform) }
      : {},
  resolve: {
    alias: [
      { find: "@esTypes", replacement: path.resolve(__dirname, "src") },
      // Dev-server only. `node_modules/path` is a real, installed npm
      // package (a transitive dep of babel-plugin-transform-scss, unrelated
      // to Node's builtin `path` module) that shadows the bare `"path"`
      // specifier during Vite's dev-time dependency resolution -- so instead
      // of falling through to Vite's automatic Node-builtin browser-external
      // stub (the same one `fs`/`os` already get, since no `node_modules/fs`
      // or `node_modules/os` package exists to shadow them), Vite finds and
      // pre-bundles that literal package. Its own code references the Node
      // global `process` unconditionally, which doesn't exist in the panel's
      // plain browser-style dev-server context, so evaluating it throws
      // `ReferenceError: process is not defined` -- and since userPresets.ts
      // imports `path` at module scope, that one throw aborts the entire
      // module graph before React ever renders (confirmed via the panel
      // going completely blank in both a plain browser and inside AE
      // itself, with zero console output, and reproduced directly by
      // manually importing index-react.tsx from a fresh script tag).
      // Aliasing to the `node:` protocol form is unambiguous -- an npm
      // package can never claim that specifier -- so it forces the same
      // automatic external-stub treatment `fs`/`os` already get. Scoped to
      // `command === "serve"` only: the production build already handles
      // `path` correctly via `rollupOptions.external` below (a real,
      // working require("path") resolved by CEP's Node integration at
      // runtime), and aliasing the bare specifier globally would make that
      // external list's `"path"` entry stop matching the (now-aliased)
      // import specifier during the build.
      ...(command === "serve" ? [{ find: /^path$/, replacement: "node:path" }] : []),
    ],
  },
  root,
  // No default `public/` dir exists under `root` (src/js), so leaving this
  // unset would be a harmless no-op -- set to `false` explicitly so intent
  // is unambiguous (see copyEmojisPlugin above for the actual asset copy).
  publicDir: false,
  clearScreen: false,
  server: {
    port: cepConfig.port,
  },
  preview: {
    port: cepConfig.servePort,
  },

  build: {
    sourcemap: isPackage ? cepConfig.zxp.sourceMap : cepConfig.build?.sourceMap,
    watch: {
      include: "src/jsx/**",
    },
    // commonjsOptions: {
    //   transformMixedEsModules: true,
    // },
    rollupOptions: {
      input,
      // fontkit does real filesystem font parsing (src/js/main/lib/fonts.ts)
      // and must run against its real Node-targeted entry point, not the
      // bundled browser build that its package.json "browser" export
      // condition resolves to for a default client-side Vite build (which
      // lacks the fs-dependent openSync API this project needs). Marking it
      // (and the Node builtins it and fonts.ts depend on) external leaves a
      // literal `require(...)` in the compiled CJS output instead of
      // inlining/stubbing them -- resolved for real at panel runtime by
      // CEP's Node integration (--enable-nodejs, see cep.config.ts). The
      // vite-cep-plugin `cep()` plugin (see its writeBundle hook) then
      // copies the real fontkit package (and its own dependencies) from
      // node_modules into the packaged extension automatically because it
      // detects the literal `require("fontkit")` call; installModules in
      // cep.config.ts declares this explicitly as well, as a non-regex-
      // dependent guarantee.
      external: ["fs", "os", "path", "fontkit"],
      output: {
        manualChunks: {},
        // esModule: false,
        preserveModules: false,
        format: "cjs",
        entryFileNames: "assets/[name]-[hash].cjs",
        chunkFileNames: "assets/[name]-[hash].cjs",
      },
    },
    target: "chrome74",
    outDir,
  },
}));

// rollup es3 build
const outPathExtendscript = path.join("dist", cepDist, "jsx", "index.js");
extendscriptConfig(
  `src/jsx/index.ts`,
  outPathExtendscript,
  cepConfig,
  extensions,
  isProduction,
  isPackage,
);
