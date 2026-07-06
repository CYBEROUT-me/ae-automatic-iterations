import {
  helloVoid,
  helloError,
  helloStr,
  helloNum,
  helloArrayStr,
  helloObj,
} from "../utils/samples";
export { helloError, helloStr, helloNum, helloArrayStr, helloObj, helloVoid };
import { dispatchTS } from "../utils/utils";
import { getLayerType, collectFills, collectStrokes, readVideoLayerState } from "./lib/layerUtils";
import { applyShapeColor } from "./lib/applyChange";
import type { LayerInfoResult, LayerInfo } from "../../shared/types";

export const helloWorld = () => {
  alert("Hello from After Effects!");
  app.project.activeItem;
};

export const ping = (name: string): { message: string } => {
  return { message: "pong: " + name };
};

export const getLayerInfo = (): LayerInfoResult => {
  const comp = app.project.activeItem;
  if (!(comp instanceof CompItem)) throw new Error("No active composition");
  const sel = comp.selectedLayers;
  if (sel.length === 0) throw new Error("No layer selected");

  const layers: LayerInfo[] = [];
  for (let i = 0; i < sel.length; i++) {
    const layer = sel[i];
    const type = getLayerType(layer);
    const info: LayerInfo = { name: layer.name, index: layer.index, type };
    if (type === "shape") {
      info.fills = collectFills((layer as ShapeLayer).property("Contents"), "Contents");
      info.strokes = collectStrokes((layer as ShapeLayer).property("Contents"), "Contents");
    } else if (type === "text") {
      const td = (layer as TextLayer).sourceText.value;
      info.color = td.fillColor;
      info.font = td.font;
      info.text = td.text;
    } else if (type === "video") {
      info.videoState = readVideoLayerState(layer as AVLayer);
    }
    layers.push(info);
  }

  return { compName: comp.name, layers };
};

// TEMPORARY — manual verification only for Task 10. Superseded by
// `previewApply` in Task 11; delete this command and its call site then.
export const debugApplyRed = (): { applied: boolean } => {
  const comp = app.project.activeItem;
  if (!(comp instanceof CompItem)) throw new Error("No active composition");
  const layer = comp.selectedLayers[0] as ShapeLayer;
  if (!layer) throw new Error("No layer selected");
  const ok = applyShapeColor(layer, "Contents/Group 1/Contents/Fill 1", [1, 0, 0]);
  return { applied: ok };
};
