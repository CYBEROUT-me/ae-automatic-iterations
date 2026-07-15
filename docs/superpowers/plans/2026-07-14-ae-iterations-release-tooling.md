# Release Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cross-platform Node release script to `ae-iterations-next` — version bump, build, git tag/push, GitHub Release + asset upload — mirroring the original `extension/`'s `package.sh`, verified via dry-run only.

**Architecture:** One script, `scripts/release.mjs`, run via `npm run release`. Its version-resolution logic is a small, pure, exported function with real unit tests; the rest is orchestration (subprocess calls to git/npm, HTTP calls to GitHub's API via Node's built-in `fetch`), verified through a `--dry-run` mode that performs the build but never touches git or GitHub.

**Tech Stack:** Node.js (native ESM, native `fetch` — no new dependencies), Vitest.

**Design spec:** `docs/superpowers/specs/2026-07-14-ae-iterations-release-tooling-design.md`

## Global Constraints

- **Cross-platform**, not bash — pure Node, no WSL/Git Bash dependency.
- **Build + verify only.** This plan's own verification steps use `--dry-run` exclusively —
  never the real git-tag/push/GitHub-release path. Actually publishing a real release is a
  separate, later, explicitly-confirmed action the user takes themselves.
- The release asset is renamed to a **fixed, version-independent name**,
  `AE-Iterations-Next.zip` — BoltCEP's own zip output is named `<displayName>_<version>.zip`,
  which changes every release.
- Without `GITHUB_TOKEN` set, the script stops after the git tag/push step (or, in `--dry-run`,
  before even that) and prints what a real publish would do next — matching the original's
  exact behavior.
- No change to the current production `extension/` or its own `install.sh`/`package.sh` — this
  phase applies only to `ae-iterations-next`.

---

### Task 1: `scripts/release.mjs`

**Files:**
- Create: `ae-iterations-next/scripts/release.mjs`
- Test: `ae-iterations-next/scripts/release.test.mjs`
- Modify: `ae-iterations-next/package.json`

**Interfaces:**
- Produces: `resolveVersion(current: string, explicit?: string): string` (exported for testing), a `release` npm script.

- [ ] **Step 1: Write the failing test**

Create `ae-iterations-next/scripts/release.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { resolveVersion } from "./release.mjs";

describe("resolveVersion", () => {
  it("auto-increments the patch version when no explicit version is given", () => {
    expect(resolveVersion("0.4.0", undefined)).toBe("0.4.1");
  });

  it("carries over a multi-digit rollover", () => {
    expect(resolveVersion("0.4.9", undefined)).toBe("0.4.10");
  });

  it("uses the explicit version verbatim when given", () => {
    expect(resolveVersion("0.4.0", "1.0.0")).toBe("1.0.0");
  });
});
```

`resolveVersion` is imported directly from `release.mjs` — the same file that, when run
directly as a script (`node scripts/release.mjs`), performs the full release flow. Importing it
as a module (as this test does) must NOT trigger that flow — Step 3 below guards the
script-entry-point code so it only runs when the file is executed directly, not when imported.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `./release.mjs` doesn't exist yet.

- [ ] **Step 3: Write the script**

Create `ae-iterations-next/scripts/release.mjs`:

```js
// Version bump + build + publish for ae-iterations-next. Mirrors the
// original extension's package.sh, adapted to BoltCEP's build pipeline and
// made genuinely cross-platform (pure Node instead of bash — no WSL/Git
// Bash dependency on Windows, no curl+node-one-liner JSON plumbing).
//
// Usage:
//   npm run release                — auto-increments the patch version
//   npm run release -- 1.0.0       — sets an explicit version
//   npm run release -- --dry-run   — version bump + build + zip rename only;
//                                    skips git tag/push and the GitHub
//                                    Release entirely (prints what those
//                                    steps would do instead)
//
// Publishing (git push --tags + creating the GitHub Release) requires
// GITHUB_TOKEN. Without it, the script stops after the git tag/push step
// and prints what a real publish would do next — matching the original's
// exact behavior.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACKAGE_JSON = path.join(ROOT, "package.json");
const REPO = "CYBEROUT-me/ae-automatic-iterations";
const RELEASE_ASSET_NAME = "AE-Iterations-Next.zip";

// Pure, testable: resolves the version to release. `explicit`, if given,
// is used as-is; otherwise the patch segment of `current` is incremented.
export function resolveVersion(current, explicit) {
  if (explicit) return explicit;
  const parts = current.split(".");
  parts[2] = String(parseInt(parts[2], 10) + 1);
  return parts.join(".");
}

function readPackageJson() {
  return JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
}

function writeVersion(pkg, version) {
  pkg.version = version;
  writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

function findBuiltZip(displayName, version) {
  const zipDir = path.join(ROOT, "dist", "zip");
  const entries = readdirSync(zipDir);
  const expected = `${displayName}_${version}.zip`;
  if (!entries.includes(expected)) {
    throw new Error(`Expected built zip "${expected}" not found in ${zipDir}. Found: ${entries.join(", ")}`);
  }
  return path.join(zipDir, expected);
}

async function publishRelease(token, version, zipPath) {
  const createRes = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tag_name: `v${version}`,
      name: `v${version}`,
      body: `AE Iterations (Next) v${version}`,
    }),
  });
  if (!createRes.ok) throw new Error(`Release creation failed: HTTP ${createRes.status}`);
  const release = await createRes.json();

  console.log(`Uploading ${RELEASE_ASSET_NAME}...`);
  const zipData = readFileSync(zipPath);
  const uploadRes = await fetch(
    `https://uploads.github.com/repos/${REPO}/releases/${release.id}/assets?name=${RELEASE_ASSET_NAME}`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/zip",
      },
      body: zipData,
    }
  );
  if (!uploadRes.ok) throw new Error(`Asset upload failed: HTTP ${uploadRes.status}`);

  console.log(`\n✓ Released v${version} -> https://github.com/${REPO}/releases/tag/v${version}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const explicitVersion = args.find((a) => a !== "--dry-run");

  const pkg = readPackageJson();
  const currentVersion = pkg.version;
  const newVersion = resolveVersion(currentVersion, explicitVersion);
  console.log(`Version: ${currentVersion} -> ${newVersion}`);

  writeVersion(pkg, newVersion);

  console.log("Building (npm run zip)...");
  execSync("npm run zip", { cwd: ROOT, stdio: "inherit" });

  const builtZip = findBuiltZip(pkg.displayName ?? "AE Iterations (Next)", newVersion);
  const fixedNameZip = path.join(path.dirname(builtZip), RELEASE_ASSET_NAME);
  copyFileSync(builtZip, fixedNameZip);
  console.log(`Renamed build artifact -> ${RELEASE_ASSET_NAME}`);

  if (dryRun) {
    console.log("\n--dry-run: stopping here. Would otherwise run:");
    console.log(`  git add package.json && git commit -m "v${newVersion}"`);
    console.log(`  git tag v${newVersion}`);
    console.log(`  git push --tags`);
    console.log(`  (if GITHUB_TOKEN set) create a GitHub Release v${newVersion} and upload ${RELEASE_ASSET_NAME}`);
    return;
  }

  console.log("Committing and tagging...");
  execSync(`git add "${PACKAGE_JSON}"`, { cwd: ROOT, stdio: "inherit" });
  execSync(`git commit -m "v${newVersion}"`, { cwd: ROOT, stdio: "inherit" });
  execSync(`git tag v${newVersion}`, { cwd: ROOT, stdio: "inherit" });
  execSync(`git push --tags`, { cwd: ROOT, stdio: "inherit" });
  console.log(`Git: pushed v${newVersion}`);

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log("\nGITHUB_TOKEN not set — skipping GitHub release.");
    console.log("  Set it once with:  export GITHUB_TOKEN=ghp_xxxx");
    console.log(`  Then re-run:       npm run release -- ${newVersion}`);
    return;
  }

  console.log(`Creating GitHub release v${newVersion}...`);
  await publishRelease(token, newVersion, fixedNameZip);
}

// Only run the release flow when this file is executed directly (`node
// scripts/release.mjs`) — NOT when imported as a module (e.g. by
// release.test.mjs importing resolveVersion). Without this guard, every
// test run would trigger a real build + attempt git/GitHub operations.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error("Release failed:", err.message);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test
```

Expected: PASS, all tests including the 3 new ones. Confirm specifically that running the test
suite did NOT print anything from `main()` (no "Version:", "Building...", etc. in the test
output) — that would mean the `isMain` guard isn't working and the script's side effects ran
during import.

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 6: Verify the release script itself, via dry-run ONLY — before touching `package.json` again**

This is real, live verification — not a formality. Run the script DIRECTLY (not via an npm
script yet — that's added in Step 8, deliberately after this verification, so that
`package.json` has no other uncommitted edits for the dry-run's version bump to get tangled up
with):

```bash
node scripts/release.mjs --dry-run
```

Expected output, in order: a "Version: X -> Y" line (patch auto-incremented), "Building (npm
run zip)..." followed by the real `npm run zip` build output, "Renamed build artifact ->
AE-Iterations-Next.zip", then the "--dry-run: stopping here..." block listing the git/GitHub
steps it did NOT run. Confirm no error occurred and the process exits 0.

Then verify the artifact really exists and is a real zip:

```bash
ls -la dist/zip/AE-Iterations-Next.zip
unzip -l dist/zip/AE-Iterations-Next.zip | head -5
```

Expected: the file exists with a non-trivial size, and `unzip -l` lists real extension files
(e.g. `CSXS/`, `main/`).

- [ ] **Step 7: Revert the dry-run's version bump**

The dry-run wrote a new version into `package.json` on disk (only the git/GitHub steps are
gated by `--dry-run` — the version write is not). Confirm this is the ONLY uncommitted change
to `package.json` right now, then revert it cleanly:

```bash
git diff package.json
```

Expected: a diff touching only the `"version"` line. Then:

```bash
git checkout -- package.json
```

This is safe at this point specifically because Step 8 (the only other `package.json` edit)
hasn't happened yet — there's nothing else to lose.

- [ ] **Step 8: Add the `release` npm script**

Open `ae-iterations-next/package.json`. Find the `"scripts"` block's `"test": "vitest run"`
line and add a `release` entry after it:

```json
    "test": "vitest run",
    "release": "node scripts/release.mjs"
```

- [ ] **Step 9: Commit**

```bash
cd ..
git add ae-iterations-next/scripts/release.mjs ae-iterations-next/scripts/release.test.mjs ae-iterations-next/package.json
git commit -m "feat: add cross-platform release script (dry-run verified)"
```

Confirm via `git diff HEAD~1 HEAD -- ae-iterations-next/package.json` that the only change to
`package.json` in this commit is the new `release` script line — NOT a version bump (that was
Step 6's dry-run side effect, cleanly reverted in Step 7 before this commit).

---

## Self-Review Notes

- **Spec coverage:** cross-platform Node script (Decision 1), build-and-verify-via-dry-run-only
  (Decision 2), fixed release asset name, `GITHUB_TOKEN`-gated publish step are all implemented
  in this single task.
- **No placeholders:** complete, real, runnable code — every step's expected output is
  concrete and checkable, not "verify it works."
- **The `isMain` guard is the one genuinely easy-to-get-wrong detail in this plan** — without
  it, importing `resolveVersion` for testing would also trigger a real build and attempt real
  git/GitHub calls on every test run. Step 4 explicitly calls out checking for this.
- **Step ordering deliberately verifies via dry-run (Step 6) BEFORE adding the `release` npm
  script to `package.json` (Step 8)** — the dry-run's version-bump side effect needs a clean
  `git checkout -- package.json` revert (Step 7), and doing that after Step 8 would risk
  reverting the intentional npm-script edit along with the unwanted version bump. Verify first,
  clean up while there's nothing else to lose, then make the real edit.
- **No manual verification recipe needed** — unlike every prior phase, there's no AE object
  model and no cross-platform filesystem behavior to verify on a second OS; dry-run output
  (checked in Step 6) is complete, sufficient, real verification on its own. The one thing that
  genuinely can't be verified by this plan is the actual git-tag/push/GitHub-release path,
  which is explicitly and deliberately out of scope (Decision 2) — a human runs that for real,
  later, when they're ready to publish.
