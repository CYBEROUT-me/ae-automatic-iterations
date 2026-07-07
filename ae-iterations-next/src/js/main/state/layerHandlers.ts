import type { LayerType } from "../../../shared/types";
import type { RowLayer } from "./rowLayers";
import { ColorFields } from "../components/ColorFields";
import { VideoFields } from "../components/VideoFields";
import { MediaFields } from "../components/MediaFields";

export interface LayerTypeHandler {
  RowFields: React.FC<{ row: RowLayer; iter: number }>;
}

export const LAYER_HANDLERS: Partial<Record<LayerType, LayerTypeHandler>> = {
  shape: { RowFields: ColorFields },
  text: { RowFields: ColorFields },
  stroke: { RowFields: ColorFields },
  video: { RowFields: VideoFields },
  media: { RowFields: MediaFields },
};
