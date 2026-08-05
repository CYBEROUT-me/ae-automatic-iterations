# Design: Badge + Logo Overlays for VAR Mode

**Date:** 2026-08-05
**Status:** Approved

---

## Goal

Give VAR mode (`ae-iterations-next`) two new overlay capabilities the user asked for directly:

1. A circle-with-text "badge" (e.g. "25") in a corner, with the text settable per VAR variant.
2. A logo image in a corner, shared across all variants.

The user also asked for a third capability — pulling a UI element out of a pre-built `.aep`
project — which is explicitly deferred (see Out of Scope).

## Scope

**VAR-mode only.** ITR mode already has an Emoji overlay (see
`2026-07-07-ae-iterations-emoji-overlay-design.md`); the user was asked whether to generalize
into a shared overlay system for both modes and explicitly chose VAR-only. `EmojiConfig` and
`RunConfig` (ITR) are not touched by this design, beyond one mechanical extraction (see
Host-side Architecture).

## Decisions

Settled during brainstorming (via direct user Q&A, not inferred):

1. **VAR-only**, not generalized to ITR. Confirmed explicitly.
2. **Badge and logo can both be active at once** (stacked), each with independent
   position/size — not a single-overlay-at-a-time picker.
3. **Badge text is per-iteration** — each VAR variant has its own text field (e.g. variant A
   = "25", variant B = "50"), matching Emoji's per-iteration-value pattern but with a plain
   text input instead of an image picker.
4. **Logo is one fixed image shared across all iterations** — a single Browse-for-file
   picker, no per-iteration variation.
5. **Position uses raw X/Y number fields**, matching the existing Emoji overlay's UI — not a
   corner-dropdown-plus-margin control. Both overlays must be **live-previewable**.
6. **Position only needs to be correct for the 9x16 render comp.** Badge and logo layers are
   added only to the `"9x16"` entry of `VAR_ASPECT_SUFFIXES` (`["9x16", "1x1", "16x9",
   "4x5"]`), never to the other three. This sidesteps the cross-aspect-ratio positioning
   problem Emoji's ITR implementation has (same x/y applied to comps of very different
   dimensions) rather than reproducing it.
7. **`.aep`-UI import is deferred**, not built in this pass — it is the most technically novel
   of the three asks (importing another AE project's composition needs ExtendScript
   validation before a UI can be designed around it) and the user chose to ship the two
   well-understood overlays first.

## Data Flow

```ts
export interface BadgeConfig {
  enabled: boolean;
  perIteration: (string | null)[]; // badge text per iteration, count-length, e.g. "25"
  x: number;
  y: number;
  size: number; // uniform scale percentage, same shape as EmojiConfig
  circleColor: [number, number, number];
  textColor: [number, number, number];
}

export interface LogoConfig {
  enabled: boolean;
  path: string | null; // one image, shared across all iterations
  x: number;
  y: number;
  size: number;
}
```

Added as optional fields on `RunVarConfig`: `badge?: BadgeConfig; logo?: LogoConfig`.
`RunConfig`/`EmojiConfig` (ITR) are unchanged.

**Run-loop sequencing per iteration**, inside `runVarIterationBatch.ts`'s existing per-iteration
loop, after the render comps are found/renamed and media is pre-imported (existing steps), and
targeting only `renderComps["9x16"]`:

1. If `cfg.badge?.enabled`: `removeBadgeFromComp(renderComps["9x16"])` (clear the previous
   iteration's badge — render comps are copied forward each iteration, same reason Emoji's
   ITR implementation re-clears every iteration) → `addBadgeToComp(renderComps["9x16"],
   cfg.badge.perIteration[iter], cfg.badge.x, cfg.badge.y, cfg.badge.size,
   cfg.badge.circleColor, cfg.badge.textColor)`. Skipped silently if `perIteration[iter]` is
   empty, matching Emoji's `if (emojiPath)` precedent.
2. If `cfg.logo?.enabled` and `cfg.logo.path`: import the logo file **once per iteration**
   (matching the existing per-iteration media-import pattern already in this file, since each
   iteration is a separate temp-copied project — nothing imported in one carries to the next)
   → `removeLogoFromComp(renderComps["9x16"])` → `addLogoToComp(renderComps["9x16"], footage,
   cfg.logo.x, cfg.logo.y, cfg.logo.size)`.
3. Existing steps continue unchanged (render video, save/close/reopen, clean, render PNG,
   collect).

Both steps are independent of the existing per-layer `applyLayerValue` dispatch — they run
regardless of whether `cfg.layers` is empty, matching Emoji's "independent of the layer-value
gate" precedent in ITR mode.

**No `cleanProject` protection needed for either overlay:**
- Badge is two plain layers added directly into the comp — `cleanProject` only inspects
  project *items* (footage/comp items in the Project panel), never touches layers within a
  comp, so badge layers are structurally invisible to it.
- Logo's imported footage item survives `cleanProject`'s unused-item removal automatically:
  `clean.ts`'s `singlePass` only removes items where `ri.usedIn.length === 0`, and once the
  logo footage is added as a layer in the 9x16 comp, `usedIn` is non-empty. Confirmed by
  reading `clean.ts` directly rather than assuming.
- `performCollect` already collects all footage generically via AE's item model — no
  special-casing needed for the new logo footage item, same as any other footage already
  collected today.

## Host-side Architecture (`src/jsx/aeft/`)

- **`lib/applyBadge.ts`** (new):
  ```ts
  export const BADGE_CIRCLE_LAYER_NAME = "AEITER_BADGE_CIRCLE";
  export const BADGE_TEXT_LAYER_NAME = "AEITER_BADGE_TEXT";
  export function removeBadgeFromComp(comp: CompItem): void;
  export function addBadgeToComp(
    comp: CompItem, text: string, x: number, y: number, size: number,
    circleColor: [number, number, number], textColor: [number, number, number]
  ): void;
  ```
  `addBadgeToComp` creates an ellipse shape layer (`comp.layers.addShape()` +
  `ADBE Vector Shape - Group`/`ADBE Vector Shape - Ellipse` content, drawn at a fixed base
  diameter then scaled by `size` as a percentage — matching `EmojiConfig`'s scale-percentage
  convention exactly, since a from-scratch shape layer has no "native size" the way an
  imported footage item does — filled with `circleColor`) and a text layer
  (`comp.layers.addText(text)`, centered justification, filled with `textColor`), both
  positioned so their visual centers land on `(x, y)`. Both spans the full comp duration
  (matching Emoji's `inPoint`/`outPoint` handling) since a badge, like an emoji, should be
  visible for the whole comp. No intermediate precomp — direct layer manipulation, consistent
  with every other `lib/apply*.ts` file in this codebase (`applyVideo.ts`, `applyChange.ts`,
  `applyEmoji.ts`) doing the same. `removeBadgeFromComp` removes both sentinel-named layers by
  name, mirroring `removeEmojiFromComp`'s loop-remove pattern exactly.

- **`lib/applyEmoji.ts`** — mechanical refactor, no behavior change: `addEmojiToComp`'s body
  (import-already-done footage → `comp.layers.add()` → position/scale/time-remap/reorder) is
  extracted into a new shared helper in a new file **`lib/applyImageOverlay.ts`**:
  ```ts
  export function addImageOverlayToComp(
    comp: CompItem, footage: FootageItem, layerName: string,
    x: number, y: number, targetIndex: number, size: number
  ): void;
  export function removeImageOverlayFromComp(comp: CompItem, layerName: string): void;
  ```
  `applyEmoji.ts`'s `addEmojiToComp`/`removeEmojiFromComp` become one-line wrappers calling
  this with `EMOJI_LAYER_NAME`. This is the only touch to ITR's emoji code path in this design;
  it is purely mechanical (same calls, same order, same sentinel-name constant), and existing
  emoji behavior is manually re-verified after the extraction (no automated tests exist for
  this file today, consistent with this codebase's established precedent for AE-object-model
  code — see Testing).

- **`lib/applyLogo.ts`** (new, thin):
  ```ts
  export const LOGO_LAYER_NAME = "AEITER_LOGO";
  export function removeLogoFromComp(comp: CompItem): void;
  export function addLogoToComp(
    comp: CompItem, footage: FootageItem, x: number, y: number, size: number
  ): void;
  ```
  Both delegate directly to `addImageOverlayToComp`/`removeImageOverlayFromComp` with
  `LOGO_LAYER_NAME` and a fixed `targetIndex` of `1` (top of stack) — logo doesn't need
  Emoji's configurable layer-index, since VAR mode's badge/logo overlays don't have an
  equivalent "attach to layer" concept in the approved scope (Emoji's `layerIndex` field is
  not part of `BadgeConfig`/`LogoConfig` above).

- **`engine/runVarIterationBatch.ts`** gains the badge/logo block described in Data Flow
  above, targeting `renderComps["9x16"]` specifically (a plain object-key lookup, not a loop
  over `VAR_ASPECT_SUFFIXES` like Emoji's ITR loop over all render comps).

- **`aeft.ts`'s `previewApply`** gains the same badge/logo application, so the existing
  per-row Preview button (already wired for VAR mode per the prior session's work) shows badge
  text and logo placement live. Since `previewApply` operates on whatever comp the panel
  passed as `cfg.compName` (the currently active/selected comp, not necessarily one already
  named with a `9x16` suffix), the badge/logo preview step applies unconditionally to that
  comp — it does not re-check the comp's name against the 9x16 suffix. This mirrors how
  `previewApply`'s existing media-swap step already applies unconditionally to whatever comp
  is active, and keeps Preview simple: it previews "what this iteration's values would do to
  the currently open comp," not "what the real Run would do to the 9x16 render comp
  specifically." This is a deliberate, called-out simplification, not an oversight.

## Panel-side Architecture (`src/js/main/`)

- **`state/store.ts`** gains flat fields, matching the `varNames`/`emoji*` convention (not a
  nested object):
  ```ts
  badgeEnabled: boolean;
  badgeTexts: (string | null)[];    // count-length, index = iteration
  badgeX: number;
  badgeY: number;
  badgeSize: number;
  badgeCircleColor: [number, number, number];
  badgeTextColor: [number, number, number];
  logoEnabled: boolean;
  logoPath: string | null;
  logoX: number;
  logoY: number;
  logoSize: number;
  ```
  with setters `setBadgeEnabled`, `setBadgeText(iter, text)`, `setBadgeX/Y/Size`,
  `setBadgeCircleColor`, `setBadgeTextColor`, `setLogoEnabled`, `setLogoPath`,
  `setLogoX/Y/Size`. Defaults: badge `x: 90, y: 90, size: 100, circleColor: [255,255,255],
  textColor: [0,0,0]`; logo `x: 990, y: 90, size: 100` (top corners, arbitrary but reasonable
  starting values — the exact numbers are cosmetic defaults, not a hard requirement, and the
  user can reposition via the number fields immediately).

- **`components/VarOverlaysCard.tsx`** (new) — VAR mode's own `.settings-card`, structurally
  mirroring ITR's Emoji/Presets card in `LayerInfoPanel.tsx` (a `settings-row` with a toggle
  switch, expanding to a section when on; a `settings-divider` between the two overlay
  sections). Rendered in `LayerInfoPanel.tsx` only when `mode === "var"` — the mirror image of
  the existing `{mode === "itr" && <div className="settings-card">...}` block.
  - **Badge overlay row** → toggle, then (when on) `BadgeSection`: shared X/Y/Size number
    inputs (same layout as `EmojiSection`'s position/size row), a circle-color `<input
    type="color">` and a text-color `<input type="color">` (reusing `hexToRgb`/`rgbToHex` from
    `lib/color.ts`, the same helpers `VideoEffectFields`' tint picker already uses), and one
    plain text input per iteration row (label = iteration number, input = badge text) —
    structurally like `EmojiSection`'s per-iteration rows but a text input instead of a
    thumbnail-grid picker, since there is no curated asset library for text.
  - **Logo overlay row** → toggle, then (when on) `LogoSection`: a Browse-for-file button
    (reusing the same `evalTS("browseForMedia")` call `MediaFields.tsx` already uses) +
    filename label, then shared X/Y/Size number inputs. No per-iteration UI.

- **Preview integration**: no new "Preview Badge"/"Preview Logo" buttons. The existing
  `previewIteration(iter)` in `LayerInfoPanel.tsx` (already unconditionally wired to every
  row's `onPreview` per the prior session's work) is extended to also pass badge/logo config
  to `previewApply`, alongside the existing `compName`/`layers`/`values` payload:
  ```ts
  evalTS("previewApply", {
    compName, layers, values: iterValues,
    badge: badgeEnabled ? { text: badgeTexts[iter], x: badgeX, y: badgeY, size: badgeSize, circleColor: badgeCircleColor, textColor: badgeTextColor } : undefined,
    logo: logoEnabled && logoPath ? { path: logoPath, x: logoX, y: logoY, size: logoSize } : undefined,
  })
  ```
  `previewApply`'s parameter type gains these two optional fields (a preview-specific shape,
  not `BadgeConfig`/`LogoConfig` verbatim, since preview needs one resolved `text`/`path` for
  the chosen iteration rather than a `perIteration` array).

- **`RunButton.tsx`**: `RunVarConfig`'s `badge`/`logo` fields are populated from the store the
  same way `varNames` already is — no gating-condition changes needed (unlike Emoji's ITR
  "emoji-only run" gate), since VAR mode already requires a target comp/layers regardless of
  overlays.

## Testing

- Host-side (`applyBadge.ts`, `applyImageOverlay.ts`, `applyLogo.ts`, the
  `runVarIterationBatch.ts` badge/logo block, the `previewApply` extension) — no automated
  tests, consistent with this codebase's established precedent for AE-object-model code
  (`applyChange.ts`, `applyVideo.ts`, `applyMedia.ts`, `applyEmoji.ts` all shipped without
  tests).
- The `applyEmoji.ts` → `applyImageOverlay.ts` extraction is manually re-verified (Preview
  Emoji in ITR mode still places/removes correctly) since it touches shipped, reviewed code,
  even though the change is mechanical.
- Panel-side (`VarOverlaysCard`, `BadgeSection`, `LogoSection`, new store setters) — Vitest +
  RTL component tests mocking `evalTS`, matching `MediaFields.test.tsx`/`VarNamesRow.test.tsx`.

## Edge Cases

- If `badgeEnabled` but a given iteration's `badgeTexts[iter]` is empty, that iteration gets
  no badge layers at all (not an empty-text badge) — matches Emoji's `if (emojiPath)`
  precedent for "no value this iteration = skip silently."
- `removeBadgeFromComp`/`removeLogoFromComp` run immediately before their corresponding
  `add*ToComp` call on `renderComps["9x16"]`, every iteration — necessary because render comps
  are copied forward from the previous iteration's state (same reason Emoji's ITR
  implementation re-clears every render comp every iteration).
- Logo's imported `FootageItem` is captured fresh each iteration (new temp-copied project per
  iteration, per VAR mode's existing architecture) — no cross-iteration sharing, matching the
  existing `preImportedMedia` pattern in `runVarIterationBatch.ts` exactly.
- Preview applies badge/logo unconditionally to whatever comp is currently active, without
  checking whether that comp's name ends in `9x16` — see the called-out simplification in
  Host-side Architecture.

## Out of Scope

- **`.aep`-UI import** (Decision 7) — deferred as a fast-follow. Needs its own brainstorming
  pass once badge/logo ship, including an ExtendScript spike to confirm how
  `app.project.importFile` behaves against an `.aep` source (does it return a folder of
  imported items, and how is a specific comp selected out of that folder) before UX can be
  designed around it.
- Two more overlay ideas noted for later, not designed here: a countdown/date-stamp overlay,
  a watermark.
- Badge/logo support in ITR mode (Decision 1) — explicitly declined by the user for this pass.
- Per-iteration logo, or per-iteration badge position/size/color (Decisions 3-4) — only badge
  *text* varies per iteration; logo doesn't vary at all.
- Any change to the current production `extension/` — this design applies only to
  `ae-iterations-next`, per this session's established scoping pattern.

## Risks

- **No subagent in this pipeline has GUI access to After Effects** (unchanged from every prior
  phase) — live-AE verification (badge circle/text actually centered and legible at the
  chosen size, logo appearing correctly on the 9x16 comp across variants, Preview producing
  the same visual result as a real Run) remains a manual step for a human tester. The
  implementation plan should include an equivalent verification recipe, matching prior phases.
- **Shape/text layer creation via ExtendScript is the one genuinely new API surface in this
  design** (every other `lib/apply*.ts` file manipulates layers that already exist, or adds an
  imported footage item — none of them synthesize a shape or text layer from nothing). The
  exact property-group paths for creating an ellipse path and setting its fill
  (`ADBE Vector Shape - Group` → `ADBE Vector Shape - Ellipse` / `ADBE Vector Graphic - Fill`)
  need to be validated live, the same way this session already validated `Array.prototype.map`
  being absent from this ExtendScript engine — assume nothing about untested API shape,
  confirm it against the real running host.
- **`applyEmoji.ts` extraction risk is low but not zero** — it is shipped, reviewed code with
  no automated tests, so a manual live-AE re-check after the extraction is the only guardrail
  against a subtle behavior change (e.g. an accidental reordering of the position/scale/
  time-remap/moveAfter sequence during extraction).
