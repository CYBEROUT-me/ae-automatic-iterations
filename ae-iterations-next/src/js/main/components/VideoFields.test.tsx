import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoFields } from "./VideoFields";
import { useAppStore } from "../state/store";
import type { RowLayer } from "../state/rowLayers";

const row: RowLayer = { layerIndex: 5, rowKey: "5", type: "video", name: "BG", fillPath: "" };

describe("VideoFields", () => {
  it("tint color and amount inputs are disabled until the tint checkbox is checked", () => {
    render(<VideoFields row={row} iter={0} />);
    const tintCheckbox = screen.getByRole("checkbox");
    const [tintColorInput] = screen.getAllByDisplayValue(/^#/);
    expect(tintColorInput).toBeDisabled();

    fireEvent.click(tintCheckbox);
    expect(tintColorInput).not.toBeDisabled();
    expect(useAppStore.getState().values["5"]?.[0]?.tint).not.toBeNull();
  });

  it("toggling flip updates the store", () => {
    render(<VideoFields row={row} iter={1} />);
    fireEvent.click(screen.getByTitle("Flip Horizontal"));
    expect(useAppStore.getState().values["5"]?.[1]?.flip).toBe(true);
  });
});
