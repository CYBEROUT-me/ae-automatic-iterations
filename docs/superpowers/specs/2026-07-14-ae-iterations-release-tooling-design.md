# Design: Release Tooling for the BoltCEP Rewrite

**Date:** 2026-07-14
**Status:** Approved

---

## Goal

Add release tooling to `ae-iterations-next` — a version-bump-and-publish script mirroring the
original `extension/`'s `package.sh`, adapted to BoltCEP's build pipeline and made genuinely
cross-platform. This phase was carved out of an "auto-update" request: auto-update's real
mechanism (check GitHub Releases, download, extract, overwrite the install) has a hard
prerequisite — a real release pipeline for `ae-iterations-next` — that doesn't exist yet. This
phase builds that prerequisite; auto-update itself remains a separate, later phase.

## Scope

**Dev-install needs no new work.** BoltCEP's own symlink mechanism (`cep.config.ts`'s
`symlink: "local"`, driven by `npm run symlink`/`npm run delsymlink`) already covers what the
original's `install.sh` does — this phase doesn't touch it.

**This phase builds ONLY the release script**, verified via its own dry-run mode. It does
**not** actually cut a real v1 release — publishing a GitHub Release is a real, visible,
one-way action, and per this session's operating rules that requires explicit user
confirmation at the time it's actually run, not something to bake into an autonomous
implementation plan. When the user is ready to publish for real, they run the script themselves
(or ask for it explicitly, at which point the actual publish step gets confirmed like any other
push/publish action).

## Decisions

Settled during brainstorming:

1. **Cross-platform Node script, not bash.** The original's `package.sh` is bash (no
   Windows support without WSL/Git Bash) and shells out to `node -e` one-liners for JSON
   parsing — both real gaps this rewrite has already fixed elsewhere (fonts, presets). The new
   script is pure Node (`ae-iterations-next/scripts/release.mjs`, run via `npm run release`),
   using built-in `fetch` for the GitHub API instead of curl+node-one-liner plumbing.
2. **Build + verify only, no real publish as part of this phase.** See Scope above.

## Architecture

**`ae-iterations-next/scripts/release.mjs`**, mirroring `package.sh`'s sections:

1. **Resolve the target version** — explicit CLI arg (`npm run release -- 1.0.0`), or
   auto-increment `package.json`'s current patch version (`npm run release`). This is pure,
   testable logic — a small exported function, not inline script code, so it gets a real unit
   test (matching `incrementProjectId`'s precedent).
2. **Write the new version back to `package.json`.**
3. **Build** — run `npm run zip` (BoltCEP's existing zxp+zip pipeline, already proven working
   across every prior phase's build verification).
4. **Rename the built zip to a fixed, version-independent name** —
   `AE-Iterations-Next.zip`. BoltCEP's own zip output is named
   `<displayName>_<version>.zip` (changes every release); a stable name is what a future
   auto-update mechanism would need to reliably find "the" asset regardless of version —
   matching the original's exact same reasoning for its fixed `AE-Iterations.zip` name. This
   costs nothing extra now and directly serves an already-identified future need, so it's
   included even though auto-update itself is out of scope.
5. **Git commit + tag + push** — `git add package.json && git commit -m "vX.Y.Z" && git tag
   vX.Y.Z && git push --tags`.
6. **GitHub Release** — if `GITHUB_TOKEN` is unset, stop here and print what a real publish
   would do next (matching the original's exact behavior). If set, `fetch` a new release via
   the GitHub API, then upload the fixed-name zip as its asset.

**Dry-run mode** (`npm run release -- --dry-run`): performs steps 1-4 only — version bump,
build, zip rename — and explicitly skips steps 5-6 (no git tag/push, no GitHub API calls),
printing what those steps *would* do instead. This is how the implementation plan verifies the
script actually works end-to-end without ever mutating the real repo or creating a real
release — the safe path used during automated implementation/testing, never the real
git-tag/GitHub-release path.

## Testing

- The version-resolution logic (auto-increment vs. explicit override) is pure and gets real
  Vitest unit tests.
- The rest of the script is orchestration (subprocess calls, HTTP requests to a real external
  API) — exercised via dry-run during implementation and manual review of its printed output,
  not deeply mocked. This matches how the original's `package.sh` was never unit-tested either;
  a real "does this actually publish correctly" check can only happen by actually publishing,
  which is explicitly deferred to the user's own explicit decision.

## Out of Scope

- Auto-update itself (checking for updates, downloading, extracting, overwriting the install) —
  the reason this phase exists, but not attempted here. A later phase, once a real release
  exists to check against.
- Actually cutting a real v1 release (Decision 2).
- Customizing the placeholder zxp-signing certificate values in `cep.config.ts` (`org:
  "Company"`, `password: "password"` — scaffold defaults, never customized) — a separate,
  one-time manual configuration decision for the user, not a code task.
- Any change to the current production `extension/` or its own `install.sh`/`package.sh` — this
  phase applies only to `ae-iterations-next`.

## Risks

- **No subagent can safely verify the actual git-tag/push/GitHub-release path** — by design,
  per Decision 2. Dry-run output is the only verification available during implementation; a
  human needs to actually run the script for real (with a real `GITHUB_TOKEN`) at least once,
  whenever they decide to publish, to confirm the live path works exactly as the dry-run implied.
- **Placeholder zxp-signing values** — not fixed by this phase, but worth flagging: shipping a
  zxp signed with `org: "Company"`/`password: "password"` still produces a real, installable
  (self-signed) package; it's just clearly unbranded. Not a blocker, just a known gap to note.
