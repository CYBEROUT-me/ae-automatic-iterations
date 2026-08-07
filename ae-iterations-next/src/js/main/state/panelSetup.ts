// Adapter between the Zustand store and the on-disk PanelSetup shape
// (lib/panelState.ts). Kept separate from both so the IO layer stays pure
// and testable, and the store stays free of persistence concerns.
//
// applySetup validates every field individually rather than trusting the
// file: this JSON lives in Application Support where a user can hand-edit
// it, it can be written by an older build, and it can be carried between
// machines. A single bad value must degrade to "that field isn't
// restored", never to a corrupted store or a thrown error during mount.

import type { AppState } from "./store";
import type { PanelSetup } from "../lib/panelState";

export function captureSetup(state: AppState): PanelSetup {
  return {
    mode: state.mode,
    count: state.count,
    sameForAll: state.sameForAll,
    varNames: state.varNames,
    emojiEnabled: state.emojiEnabled,
    emojiPaths: state.emojiPaths,
    emojiX: state.emojiX,
    emojiY: state.emojiY,
    emojiSize: state.emojiSize,
    emojiLayerIndex: state.emojiLayerIndex,
    badgeEnabled: state.badgeEnabled,
    badgeTexts: state.badgeTexts,
    badgeX: state.badgeX,
    badgeY: state.badgeY,
    badgeSize: state.badgeSize,
    badgeCircleColor: state.badgeCircleColor,
    badgeTextColor: state.badgeTextColor,
    badgeLayerIndex: state.badgeLayerIndex,
    badgeEnabledPerIteration: state.badgeEnabledPerIteration,
    logoEnabled: state.logoEnabled,
    logoPath: state.logoPath,
    logoX: state.logoX,
    logoY: state.logoY,
    logoSize: state.logoSize,
    logoLayerIndex: state.logoLayerIndex,
    logoPerIteration: state.logoPerIteration,
  };
}

const isBool = (v: unknown): v is boolean => typeof v === "boolean";
// Rejects NaN and Infinity as well as non-numbers: a NaN count would render
// Array.from({length: NaN}) as zero rows with no visible explanation.
const isNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";

const isArrayOf = <T>(v: unknown, check: (x: unknown) => x is T): v is T[] =>
  Array.isArray(v) && v.every(check);

const isStrOrNull = (v: unknown): v is string | null => v === null || typeof v === "string";

const isColor = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every(isNum);

export function applySetup(setup: PanelSetup | null | undefined): Partial<AppState> {
  const out: Partial<AppState> = {};
  if (!setup || typeof setup !== "object") return out;

  if (setup.mode === "itr" || setup.mode === "var") out.mode = setup.mode;
  // Clamped to the range the Count field itself enforces, so a file can't
  // reinstate a value the UI would refuse to accept.
  if (isNum(setup.count) && setup.count >= 1 && setup.count <= 20) out.count = Math.floor(setup.count);
  if (isBool(setup.sameForAll)) out.sameForAll = setup.sameForAll;
  if (isArrayOf(setup.varNames, isStr)) out.varNames = setup.varNames;

  if (isBool(setup.emojiEnabled)) out.emojiEnabled = setup.emojiEnabled;
  if (isArrayOf(setup.emojiPaths, isStrOrNull)) out.emojiPaths = setup.emojiPaths;
  if (isNum(setup.emojiX)) out.emojiX = setup.emojiX;
  if (isNum(setup.emojiY)) out.emojiY = setup.emojiY;
  if (isNum(setup.emojiSize)) out.emojiSize = setup.emojiSize;
  if (isNum(setup.emojiLayerIndex)) out.emojiLayerIndex = setup.emojiLayerIndex;

  if (isBool(setup.badgeEnabled)) out.badgeEnabled = setup.badgeEnabled;
  if (isArrayOf(setup.badgeTexts, isStrOrNull)) out.badgeTexts = setup.badgeTexts;
  if (isNum(setup.badgeX)) out.badgeX = setup.badgeX;
  if (isNum(setup.badgeY)) out.badgeY = setup.badgeY;
  if (isNum(setup.badgeSize)) out.badgeSize = setup.badgeSize;
  if (isColor(setup.badgeCircleColor)) out.badgeCircleColor = setup.badgeCircleColor;
  if (isColor(setup.badgeTextColor)) out.badgeTextColor = setup.badgeTextColor;
  if (isNum(setup.badgeLayerIndex)) out.badgeLayerIndex = setup.badgeLayerIndex;
  if (isArrayOf(setup.badgeEnabledPerIteration, isBool)) out.badgeEnabledPerIteration = setup.badgeEnabledPerIteration;

  if (isBool(setup.logoEnabled)) out.logoEnabled = setup.logoEnabled;
  if (isStrOrNull(setup.logoPath)) out.logoPath = setup.logoPath;
  if (isNum(setup.logoX)) out.logoX = setup.logoX;
  if (isNum(setup.logoY)) out.logoY = setup.logoY;
  if (isNum(setup.logoSize)) out.logoSize = setup.logoSize;
  if (isNum(setup.logoLayerIndex)) out.logoLayerIndex = setup.logoLayerIndex;
  if (isArrayOf(setup.logoPerIteration, isBool)) out.logoPerIteration = setup.logoPerIteration;

  return out;
}
