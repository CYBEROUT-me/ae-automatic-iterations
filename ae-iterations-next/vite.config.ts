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
export default defineConfig({
  plugins: [
    react(),
    cep(config),
    copyEmojisPlugin(),
  ],
  resolve: {
    alias: [{ find: "@esTypes", replacement: path.resolve(__dirname, "src") }],
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
});

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
