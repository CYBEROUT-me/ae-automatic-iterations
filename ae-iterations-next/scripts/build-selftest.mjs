// scripts/build-selftest.mjs — builds src/jsx/selftest.ts into
// selftest/aeiter-selftest.jsx, a standalone ExtendScript file meant to be
// run directly in After Effects (File > Scripts > Run Script File...),
// completely separate from the CEP extension in dist/cep.
//
// Deliberately its OWN Node process, not a second call to vite.config.ts's
// extendscriptConfig(): that was tried first and reliably crashed
// vite-cep-plugin's `cep()` plugin (used in vite.config.ts's main `plugins`
// array for the panel build), which has an internal dependency on the
// extension's own extendscriptConfig call completing within that same
// `vite build` invocation -- skipping it broke that dependency, and running
// a second one alongside it raced on shared state inside vite-cep-plugin's
// jsxPonyfill plugin. Both failed with "extendscript-ponyfill-resolver" /
// "Cannot read properties of undefined (reading 'code')". This script
// duplicates the same rollup+babel+jsxInclude/jsxBin/jsxPonyfill pipeline
// vite.es.config.ts's extendscriptConfig uses (so the compiled output has
// the exact same ExtendScript-compatibility guarantees as the shipped
// extension), just in total isolation from vite.config.ts and its plugins.

import { rollup } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import json from "@rollup/plugin-json";
import { jsxInclude, jsxBin, jsxPonyfill } from "vite-cep-plugin";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensions = [".js", ".ts", ".tsx"];
const selftestDir = path.join(root, "selftest");
// jsxPonyfill's own generateBundle hook (node_modules/vite-cep-plugin/lib/
// index.js) hardcodes `Object.keys(bundle).find((item) => item ===
// "index.js")` to locate the chunk to inject its ponyfill header into --
// NOT whatever output.file is actually configured to. Any other output
// filename makes that lookup return undefined and crash on `.code`
// (confirmed by reproducing it with "aeiter-selftest.jsx" directly). Build
// to that exact required name, then rename to the friendlier final name
// once rollup is done with it.
const buildFile = path.join(selftestDir, "index.js");
const finalFile = path.join(selftestDir, "aeiter-selftest.jsx");

const config = {
  input: path.join(root, "src", "jsx", "selftest.ts"),
  treeshake: true,
  output: {
    file: buildFile,
    sourcemap: false,
  },
  plugins: [
    json(),
    nodeResolve({ extensions }),
    babel({
      extensions,
      exclude: /node_modules/,
      babelrc: false,
      babelHelpers: "inline",
      presets: ["@babel/preset-env", "@babel/preset-typescript"],
      plugins: ["@babel/plugin-syntax-dynamic-import", "@babel/plugin-proposal-class-properties"],
    }),
    jsxPonyfill(),
    jsxInclude({ iife: true, globalThis: "thisObj" }),
    // Matches cep.config.ts's build.jsxBin/zxp.jsxBin ("off") -- this
    // project never binary-encodes its ExtendScript, so the self-test
    // script shouldn't either.
    jsxBin("off"),
  ],
};

const bundle = await rollup(config);
await bundle.write(config.output);
await bundle.close();
fs.renameSync(buildFile, finalFile);
if (fs.existsSync(buildFile + ".map")) fs.renameSync(buildFile + ".map", finalFile + ".map");
console.log("Built " + finalFile);
