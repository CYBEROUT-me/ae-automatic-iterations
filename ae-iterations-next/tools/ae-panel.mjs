/**
 * Drives this extension's CEP panel — and, through it, After Effects itself —
 * over the panel's Chrome DevTools Protocol port.
 *
 * Adapted from a shared "AE Connect" helper (panel.mjs), with the ExtendScript
 * bridge added and the defaults wired to this project.
 *
 *   node tools/ae-panel.mjs jsx 'app.project.numItems.toString()'
 *   node tools/ae-panel.mjs jsx --file probe.jsx
 *   node tools/ae-panel.mjs eval '({ title: document.title })'
 *   node tools/ae-panel.mjs shot /tmp/panel.png
 *   node tools/ae-panel.mjs reload
 *
 * Why this exists rather than `osascript ... DoScriptFile`: sending Apple
 * events to After Effects requires a macOS Automation (TCC) grant tied to the
 * *calling* application. An agent shell running under a host app that macOS
 * never prompts for simply cannot get that grant — every attempt returns
 * "-1743 Not authorized to send Apple events". CDP is an ordinary localhost
 * socket with no such gate, and the panel already holds a legitimate bridge
 * into ExtendScript (`window.__adobe_cep__.evalScript`), so going in through
 * the panel works where the direct route is refused outright.
 *
 * Requires: PlayerDebugMode set, the built extension symlinked, and THE PANEL
 * OPEN in After Effects. A closed panel has no page and no port.
 *
 * Env overrides: AE_PANEL_PORT (default 8860, from cep.config.ts's
 * startingDebugPort) and AE_PANEL_MATCH (default the extension id).
 */
import { readFileSync, writeFileSync } from "node:fs";

const PORT = Number(process.env.AE_PANEL_PORT || 8860);
const MATCH = process.env.AE_PANEL_MATCH || "com.aeiter.iteration.next";

const [, , cmd, ...args] = process.argv;

const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

let targets;
try {
  targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
} catch {
  die(
    `Nothing is listening on ${PORT}.\n` +
      `  - Is the AE Iterations panel OPEN in After Effects? (Window > Extensions)\n` +
      `  - Was the extension built (npm run build) and symlinked?\n` +
      `  - defaults write com.adobe.CSXS.12 PlayerDebugMode 1`
  );
}

const page = targets.find((t) => (t.url || "").includes(MATCH));
if (!page) {
  die(
    `No page matching "${MATCH}" on ${PORT}.\n` +
      `Debug ports are shared between extensions — another one may have claimed it.\n` +
      `Pages seen: ${targets.map((t) => (t.url || "").slice(0, 70)).join(", ") || "none"}`
  );
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let id = 0;
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  const resolve = pending.get(msg.id);
  if (resolve) resolve(msg.result);
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
await new Promise((res) => (ws.onopen = res));

const evaluate = (expression) =>
  send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });

if (cmd === "jsx") {
  // ExtendScript has no return channel of its own, but evalScript's callback
  // does — it hands back whatever the script's last expression evaluates to,
  // always as a string. Anything structured has to be JSON.stringify'd by the
  // script itself.
  const source = args[0] === "--file" ? readFileSync(args[1], "utf8") : args.join(" ");
  const r = await evaluate(`new Promise((resolve) => {
    try {
      window.__adobe_cep__.evalScript(${JSON.stringify(source)}, (res) => resolve(String(res)));
    } catch (e) {
      resolve("BRIDGE ERROR: " + String(e));
    }
  })`);
  const value = r.result?.value;
  if (value === undefined) {
    // An undefined result almost always means the *panel-side* expression
    // threw rather than the ExtendScript failing — surface the raw reply so
    // the distinction is visible instead of guessed at.
    console.error("No value returned. Raw CDP reply:");
    console.error(JSON.stringify(r, null, 2));
    process.exit(1);
  }
  // ExtendScript's own error convention: evalScript resolves with the string
  // "EvalScript error." when the script throws. Say so plainly rather than
  // printing it as if it were a result.
  if (value === "EvalScript error.") {
    console.error("ExtendScript threw. Wrap the body in try/catch and return e.toString() to see why.");
    process.exit(1);
  }
  console.log(value);
} else if (cmd === "eval") {
  const r = await evaluate(args.join(" "));
  console.log(JSON.stringify(r.result?.value ?? r, null, 2));
} else if (cmd === "shot") {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const out = args[0] || "panel.png";
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("wrote", out);
} else if (cmd === "reload") {
  await send("Page.reload", {});
  console.log("reloaded");
} else {
  die("usage: node tools/ae-panel.mjs <jsx '<code>' | jsx --file <f.jsx> | eval '<expr>' | shot <f.png> | reload>");
}

ws.close();
