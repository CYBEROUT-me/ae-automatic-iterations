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
}

export interface TestVarCompsResult {
  log: string[];
}
