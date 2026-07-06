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
import { findCompByName } from "./lib/findComp";
import { applyLayerValue } from "./lib/applyLayerValue";
import type { LayerInfoResult, LayerInfo, CfgLayer, LayerValue } from "../../shared/types";

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

// Applies one iteration's values to the target comp's layers in place, for
// live in-AE preview. Wrapped in a single undo group so the panel's Preview
// button is one Ctrl+Z away from a no-op. Ported from host.jsx's
// debugApplyChangeJSON (lines 235-276), minus the ITR-comp listing and emoji
// removal (both out of scope for this plan).
export const previewApply = (cfg: { compName: string; layers: CfgLayer[]; values: LayerValue[] }): { log: string[] } => {
  const comp = findCompByName(cfg.compName);
  if (!comp) throw new Error("Comp not found: " + cfg.compName);

  const log: string[] = [];
  app.beginSuppressDialogs();
  app.beginUndoGroup("Preview Apply");
  for (let li = 0; li < cfg.layers.length; li++) {
    const lc = cfg.layers[li];
    const layer = comp.layer(lc.index);
    if (!layer) {
      log.push("Layer " + lc.index + ": NOT FOUND");
      continue;
    }
    log.push("Layer " + lc.index + ": " + layer.name + "  [" + lc.layerType + "]");
    log.push(...applyLayerValue(layer, lc, cfg.values[li]).map((l) => "  " + l));
  }
  app.endUndoGroup();
  app.endSuppressDialogs(false);

  return { log };
};
