// jsx/selftest.ts — standalone self-test script, deliberately SEPARATE from
// the CEP extension bundle (dist/cep). Built to selftest/aeiter-selftest.jsx
// (see vite.config.ts's BUILD_SELFTEST-gated extendscriptConfig call, and
// package.json's "build:selftest" script) and run directly in After Effects
// via File > Scripts > Run Script File... -- no panel, no evalTS round-trip.
//
// Reuses the exact same lib/*.ts functions the extension itself calls, so a
// pass here is real evidence about the shipped behavior, not a reimplemented
// approximation of it.
//
// First batch, by design, covers the render/clean/collect pipeline only --
// this is the exact area of the still-unresolved "only 9x16.png renders"
// bug, since a synthetic, isolated repro of that pipeline is something no
// amount of outside-AE code reading could produce.
//
// Plain for-loops throughout, no Array.prototype.map: confirmed missing from
// this ExtendScript engine at runtime (see aeft.ts's previewApply comment),
// even though .filter/.forEach/for-of/spread/indexOf/Object.keys/slice all
// work fine there.

import { renderPNGs } from "./aeft/lib/render";
import { cleanProject } from "./aeft/lib/clean";
import { performCollect } from "./aeft/lib/collect";
import { findCompByName, findVarComp } from "./aeft/lib/findComp";
import { VAR_ASPECT_SUFFIXES } from "./aeft/lib/naming";

// ── Tiny assertion + runner framework ───────────────────────────────────

interface TestCase {
  name: string;
  fn: () => void;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// Runs every test even if an earlier one throws -- one bad test must never
// hide the results of the rest (the exact lesson from render.ts's own
// resolutionFactor bug this session: an uncaught exception silently
// aborting a loop is indistinguishable from "everything after this point
// just didn't happen").
function runTests(tests: TestCase[]): TestResult[] {
  const results: TestResult[] = [];
  for (let i = 0; i < tests.length; i++) {
    try {
      tests[i].fn();
      results.push({ name: tests[i].name, passed: true });
    } catch (e: any) {
      results.push({ name: tests[i].name, passed: false, error: e.message });
    }
  }
  return results;
}

// ── Isolated project sandbox ─────────────────────────────────────────────

// Every test below creates comps/layers and runs cleanProject (which
// reorganizes the ENTIRE project's item panel into folders) -- running any
// of this against the user's real, currently open project would corrupt
// their actual work as a side effect of "just running a test". A fresh
// app.newProject() is required; the confirm() below is the one interactive
// gate, so a user is never surprised by their unsaved work disappearing.
function withTempProject(fn: () => void): void {
  const originalFile = app.project && app.project.file ? app.project.file : null;
  const proceed = confirm(
    "AE Iterations self-test will open a temporary blank project to run tests, " +
      "then restore your current project afterward.\n\n" +
      "Any UNSAVED changes in your current project will be lost -- save first if you need to.\n\n" +
      "Continue?"
  );
  if (!proceed) throw new Error("Cancelled.");
  app.newProject();
  try {
    fn();
  } finally {
    app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    if (originalFile && originalFile.exists) {
      app.open(originalFile);
    } else {
      app.newProject();
    }
  }
}

// ── Fixture builders ─────────────────────────────────────────────────────

// namePrefix is unique per test (not just per run) so tests never collide
// on comp names within the same throwaway project -- no cleanup-between-
// tests needed, the whole project gets discarded at the end regardless.
function buildFixtureComps(namePrefix: string): Record<string, CompItem> {
  const comps: Record<string, CompItem> = {};
  for (let i = 0; i < VAR_ASPECT_SUFFIXES.length; i++) {
    const suffix = VAR_ASPECT_SUFFIXES[i];
    const comp = app.project.items.addComp(namePrefix + "_" + suffix, 200, 200, 1, 2, 24);
    comp.layers.addSolid([0.2, 0.5, 0.8], "bg", 200, 200, 1);
    comps[suffix] = comp;
  }
  return comps;
}

// ── Tests ─────────────────────────────────────────────────────────────────

function testRenderPngsAllValid(outFolder: Folder): void {
  const comps = buildFixtureComps("AEITER_ST_RENDER");
  renderPNGs(comps, outFolder, VAR_ASPECT_SUFFIXES);
  for (let i = 0; i < VAR_ASPECT_SUFFIXES.length; i++) {
    const suffix = VAR_ASPECT_SUFFIXES[i];
    const pngFile = new File(outFolder.fsName + "/" + comps[suffix].name + ".png");
    assertTrue(pngFile.exists, "Expected PNG for " + suffix + " at " + pngFile.fsName);
    assertTrue(pngFile.length > 0, "PNG for " + suffix + " exists but is empty");
  }
}

function testRenderPngsContinuesPastMissingComp(outFolder: Folder): void {
  const comps = buildFixtureComps("AEITER_ST_PARTIAL");
  // Deliberately omit "1x1" to simulate a lookup failure for one aspect.
  const partial: Record<string, CompItem> = { "9x16": comps["9x16"], "16x9": comps["16x9"], "4x5": comps["4x5"] };
  let threw = false;
  let errorMessage = "";
  try {
    renderPNGs(partial, outFolder, VAR_ASPECT_SUFFIXES);
  } catch (e: any) {
    threw = true;
    errorMessage = e.message;
  }
  assertTrue(threw, "Expected renderPNGs to throw an aggregated error when a comp is missing");
  assertTrue(errorMessage.indexOf("1x1") !== -1, "Expected error to mention the missing suffix, got: " + errorMessage);
  const survivingSuffixes = ["9x16", "16x9", "4x5"];
  for (let i = 0; i < survivingSuffixes.length; i++) {
    const suffix = survivingSuffixes[i];
    const pngFile = new File(outFolder.fsName + "/" + partial[suffix].name + ".png");
    assertTrue(pngFile.exists, "Expected PNG for " + suffix + " to still render despite missing 1x1");
  }
}

function testCleanProjectProtectsNamedComps(): void {
  const comps = buildFixtureComps("AEITER_ST_CLEAN");
  const names: string[] = [];
  for (let i = 0; i < VAR_ASPECT_SUFFIXES.length; i++) names.push(comps[VAR_ASPECT_SUFFIXES[i]].name);
  cleanProject(names);
  for (let i = 0; i < names.length; i++) {
    assertTrue(!!findCompByName(names[i]), "Comp " + names[i] + " should still exist after cleanProject");
  }
}

// The centerpiece: mirrors runVarIterationBatch.ts's exact real sequence
// (save, close, reopen, clean, re-resolve by name, render) against a
// disposable fixture. A failure here would be the first real, reproducible
// evidence of where the live "only 9x16.png renders" bug actually is.
function testFullPipelineSaveCloseReopenCleanRender(outFolder: Folder): void {
  const comps = buildFixtureComps("AEITER_ST_PIPELINE");
  const names: string[] = [];
  for (let i = 0; i < VAR_ASPECT_SUFFIXES.length; i++) names.push(comps[VAR_ASPECT_SUFFIXES[i]].name);

  const tempProjFile = new File(Folder.temp.fsName + "/aeiter_selftest_pipeline.aep");
  if (tempProjFile.exists) tempProjFile.remove();
  app.project.save(tempProjFile);

  app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
  app.open(tempProjFile);

  cleanProject(names);

  const reloadedComps: Record<string, CompItem> = {};
  for (let i = 0; i < VAR_ASPECT_SUFFIXES.length; i++) {
    const suffix = VAR_ASPECT_SUFFIXES[i];
    const found = findVarComp(names[i]);
    assertTrue(!!found, "Comp " + names[i] + " should be findable after save/close/reopen/clean");
    if (found) reloadedComps[suffix] = found;
  }

  renderPNGs(reloadedComps, outFolder, VAR_ASPECT_SUFFIXES);

  for (let i = 0; i < VAR_ASPECT_SUFFIXES.length; i++) {
    const suffix = VAR_ASPECT_SUFFIXES[i];
    const pngFile = new File(outFolder.fsName + "/" + reloadedComps[suffix].name + ".png");
    assertTrue(pngFile.exists, "Expected PNG for " + suffix + " after full save/close/reopen/clean/render pipeline");
  }

  try {
    tempProjFile.remove();
  } catch (e) {}
}

// performCollect only touches FootageItems (a Solid's source has no backing
// file, so it's skipped) -- a solids-only comp is a real, valid way to
// exercise the collect/relink machinery without needing bundled binary
// fixtures.
function testPerformCollectProducesSelfContainedProject(): void {
  const comp = app.project.items.addComp("AEITER_ST_COLLECT", 200, 200, 1, 2, 24);
  comp.layers.addSolid([0.3, 0.6, 0.2], "bg", 200, 200, 1);

  const tempProjFile = new File(Folder.temp.fsName + "/aeiter_selftest_collect_src.aep");
  if (tempProjFile.exists) tempProjFile.remove();
  app.project.save(tempProjFile);

  const collectFolder = new Folder(Folder.temp.fsName + "/aeiter_selftest_collect_out");
  if (!collectFolder.exists) collectFolder.create();

  performCollect(tempProjFile, collectFolder);

  const footageFolder = new Folder(collectFolder.fsName + "/(Footage)");
  assertTrue(footageFolder.exists, "Expected (Footage) folder to be created by performCollect");

  const collectedProjFile = new File(collectFolder.fsName + "/" + tempProjFile.name);
  assertTrue(collectedProjFile.exists, "Expected a collected project file at " + collectedProjFile.fsName);

  try {
    tempProjFile.remove();
  } catch (e) {}
}

// ── Reporting ─────────────────────────────────────────────────────────────

function writeLog(results: TestResult[], logFile: File): void {
  const lines: string[] = [];
  lines.push("AE Iterations self-test -- " + new Date().toString());
  lines.push("");
  let passed = 0;
  let failed = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.passed) passed++;
    else failed++;
    lines.push((r.passed ? "PASS" : "FAIL") + " -- " + r.name + (r.error ? ": " + r.error : ""));
  }
  lines.push("");
  lines.push(passed + " passed, " + failed + " failed, " + results.length + " total.");
  logFile.encoding = "UTF-8";
  logFile.open("w");
  logFile.write(lines.join("\n"));
  logFile.close();
}

function showSummaryAlert(results: TestResult[], logFile: File): void {
  let passed = 0;
  let failed = 0;
  const failLines: string[] = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].passed) passed++;
    else {
      failed++;
      failLines.push("- " + results[i].name + ": " + results[i].error);
    }
  }
  let msg = "AE Iterations self-test: " + passed + " passed, " + failed + " failed.\n\n";
  if (failLines.length) msg += failLines.join("\n") + "\n\n";
  msg += "Full log: " + logFile.fsName;
  alert(msg);
}

// ── Entry point ───────────────────────────────────────────────────────────

function main(): void {
  const outFolder = new Folder(Folder.temp.fsName + "/aeiter_selftest_output");
  if (!outFolder.exists) outFolder.create();
  const logFile = new File(outFolder.fsName + "/results.log");

  let results: TestResult[] = [];
  try {
    withTempProject(() => {
      results = runTests([
        { name: "renderPNGs renders all 4 valid comps", fn: () => testRenderPngsAllValid(outFolder) },
        { name: "renderPNGs continues past a missing comp", fn: () => testRenderPngsContinuesPastMissingComp(outFolder) },
        { name: "cleanProject protects named comps", fn: testCleanProjectProtectsNamedComps },
        {
          name: "full pipeline: save, close, reopen, clean, render",
          fn: () => testFullPipelineSaveCloseReopenCleanRender(outFolder),
        },
        { name: "performCollect produces a self-contained project", fn: testPerformCollectProducesSelfContainedProject },
      ]);
    });
  } catch (e: any) {
    alert("AE Iterations self-test could not run: " + e.message);
    return;
  }

  writeLog(results, logFile);
  showSummaryAlert(results, logFile);
}

main();
