export type LayerType = "shape" | "text" | "stroke" | "video" | "media" | "unknown";

export interface FillInfo {
  path: string;
  color: [number, number, number];
}

export interface StrokeInfo {
  path: string;
  color: [number, number, number];
}

export interface VideoState {
  flip: boolean;
  bw: boolean;
  tint: [number, number, number] | null;
  tintAmount: number;
  hue: number;
}

export interface LayerInfo {
  name: string;
  index: number;
  type: LayerType;
  fills?: FillInfo[];
  strokes?: StrokeInfo[];
  color?: [number, number, number] | null;
  font?: string;
  text?: string;
  videoState?: VideoState;
}

export interface LayerInfoResult {
  compName: string;
  layers: LayerInfo[];
}

export interface LayerValue {
  color?: [number, number, number] | null;
  font?: string | null;
  content?: string | null;
  flip?: boolean;
  bw?: boolean;
  tint?: [number, number, number] | null;
  tintAmount?: number;
  hue?: number;
  mediaPath?: string | null;
}

export interface EmojiConfig {
  enabled: boolean;
  perIteration: (string | null)[]; // emoji file path per iteration, count-length
  x: number;
  y: number;
  size: number;
  layerIndex: number; // 1-based position from top of layer stack
}

export interface BadgeConfig {
  enabled: boolean;
  perIteration: (string | null)[]; // badge text per iteration, count-length — free text, e.g. "25+"
  x: number;
  y: number;
  size: number; // uniform scale percentage, same convention as EmojiConfig
  circleColor: [number, number, number];
  textColor: [number, number, number];
  layerIndex?: number; // 0/unset = top of stack; a positive index controls
                        // stacking position only, exactly like
                        // LogoConfig/EmojiConfig.layerIndex (duration
                        // always spans the full comp regardless)
}

export interface LogoConfig {
  enabled: boolean;
  path: string | null; // path to a file inside the logo library folder (see logoLibrary.ts)
  x: number;
  y: number;
  size: number;
  layerIndex?: number; // 0/unset = top of stack; a positive index controls
                        // stacking position only, exactly like EmojiConfig.layerIndex
                        // (duration always spans the full comp regardless)
  perIteration?: boolean[]; // per-iteration on/off, count-length; a missing
                             // entry (undefined) defaults to true (applied),
                             // so an untouched/shorter array keeps the
                             // pre-existing "applies to every iteration"
                             // behavior unchanged
}

export interface CfgLayer {
  index: number;
  name: string;
  fillPath: string;
  layerType: LayerType;
}

export interface RunConfig {
  compName: string;
  layers: CfgLayer[];
  values: LayerValue[][]; // [iter][layer row index], matching `layers` order
  count: number;
  emoji?: EmojiConfig;
}

export interface RunResult {
  warnings: string[];
}

export interface RunVarConfig {
  compName: string;
  layers: CfgLayer[];
  values: LayerValue[][]; // [iter][layer row index], matching `layers` order
  varNames: string[];
  count: number;
  badge?: BadgeConfig;
  logo?: LogoConfig;
}

export interface TestVarCompsResult {
  log: string[];
}
