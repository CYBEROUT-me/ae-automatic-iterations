import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PresetPanel } from "./PresetPanel";
import { useAppStore } from "../state/store";
import { hexToRgb } from "../lib/color";
import * as userPresetsLib from "../lib/userPresets";
import type { RowLayer } from "../state/rowLayers";

vi.mock("../lib/userPresets", () => ({
  loadUserPresets: vi.fn(() => []),
  saveUserPresets: vi.fn(),
}));

const colorRow: RowLayer = { layerIndex: 1, rowKey: "1", type: "shape", name: "Rect", fillPath: "" };
const videoRow: RowLayer = { layerIndex: 2, rowKey: "2", type: "video", name: "BG", fillPath: "" };

describe("PresetPanel", () => {
  beforeEach(() => {
    vi.mocked(userPresetsLib.loadUserPresets).mockReturnValue([]);
    vi.mocked(userPresetsLib.saveUserPresets).mockReset();
    useAppStore.setState({ rowLayers: [colorRow], count: 3, values: {} });
  });

  it("shows only color presets when row 0 is a color-capable row", () => {
    render(<PresetPanel />);
    expect(screen.getByText("Brand Blue")).toBeInTheDocument();
    expect(screen.queryByText("Warm Tints")).not.toBeInTheDocument();
  });

  it("shows only video presets when row 0 is a video row", () => {
    useAppStore.setState({ rowLayers: [videoRow], count: 3, values: {} });
    render(<PresetPanel />);
    expect(screen.getByText("Warm Tints")).toBeInTheDocument();
    expect(screen.queryByText("Brand Blue")).not.toBeInTheDocument();
  });

  it("applies a color preset's hex values to row 0, clamped to the current count", () => {
    render(<PresetPanel />);
    fireEvent.click(screen.getAllByText("Apply")[0]);
    const values = useAppStore.getState().values["1"];
    expect(values).toHaveLength(3);
    expect(values[0].color).toEqual(hexToRgb("#0057B7"));
    expect(values[1].color).toEqual(hexToRgb("#1A73E8"));
    expect(values[2].color).toEqual(hexToRgb("#4285F4"));
  });

  it("saves the current row-0 state as a new user preset", () => {
    useAppStore.getState().setValue("1", 0, { color: hexToRgb("#123456") });
    render(<PresetPanel />);
    fireEvent.change(screen.getByPlaceholderText("Preset name"), { target: { value: "My Preset" } });
    fireEvent.click(screen.getByText("Save Preset"));
    expect(userPresetsLib.saveUserPresets).toHaveBeenCalledWith([
      expect.objectContaining({ name: "My Preset", colors: ["#123456", "#FF0000", "#FF0000"] }),
    ]);
  });

  it("deletes a user preset", () => {
    vi.mocked(userPresetsLib.loadUserPresets).mockReturnValue([{ name: "Old One", colors: ["#000000"] }]);
    render(<PresetPanel />);
    fireEvent.click(screen.getByTitle("Delete preset"));
    expect(userPresetsLib.saveUserPresets).toHaveBeenCalledWith([]);
  });
});
