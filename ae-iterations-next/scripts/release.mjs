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
import { fileURLToPath, pathToFileURL } from "node:url";
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
// test run would trigger a real build and attempt real git/GitHub operations.
//
// Uses pathToFileURL rather than a plain `file://${process.argv[1]}`
// string-concat: on any path containing spaces or other characters that
// import.meta.url percent-encodes (e.g. this repo's own "AE Iter
// Scripting" directory), and on Windows (backslashes, drive letters), the
// naive concatenation never equals import.meta.url even when the file IS
// the entry point — pathToFileURL performs the same normalization/encoding
// import.meta.url uses, so the comparison is accurate cross-platform.
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error("Release failed:", err.message);
    process.exitCode = 1;
  });
}
