import type { LayerType } from "../../../shared/types";
import type { RowLayer } from "./rowLayers";
import { ColorFields } from "../components/ColorFields";

export interface LayerTypeHandler {
  RowFields: React.FC<{ row: RowLayer; iter: number }>;
}

export const LAYER_HANDLERS: Partial<Record<LayerType, LayerTypeHandler>> = {
  shape: { RowFields: ColorFields },
  text: { RowFields: ColorFields },
  stroke: { RowFields: ColorFields },
};
