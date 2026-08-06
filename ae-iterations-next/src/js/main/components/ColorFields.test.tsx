import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorFields } from "./ColorFields";
import { useAppStore } from "../state/store";
import type { RowLayer } from "../state/rowLayers";

vi.mock("../lib/fonts", () => ({
  loadFonts: vi.fn().mockResolvedValue(["Helvetica-Bold", "ArialMT"]),
}));

const textRow: RowLayer = { layerIndex: 1, rowKey: "1", type: "text", name: "Title", fillPath: "" };

describe("ColorFields — hex text field", () => {
  it("keeps a partial, incomplete hex value visible instead of snapping back", () => {
    useAppStore.setState({ values: {} });
    render(<ColorFields row={textRow} iter={0} />);
    const hexInput = screen.getByDisplayValue("#FF0000");
    fireEvent.change(hexInput, { target: { value: "#FF0" } });
    expect(hexInput).toHaveValue("#FF0");
    // Not yet a valid 6-digit hex, so nothing should have committed to the store.
    expect(useAppStore.getState().values["1"]?.[0]?.color).toBeUndefined();
  });

  it("commits once the typed value normalises to a complete hex", () => {
    useAppStore.setState({ values: {} });
    render(<ColorFields row={textRow} iter={0} />);
    const hexInput = screen.getByDisplayValue("#FF0000");
    fireEvent.change(hexInput, { target: { value: "#00" } });
    fireEvent.change(hexInput, { target: { value: "#00FF00" } });
    expect(hexInput).toHaveValue("#00FF00");
    expect(useAppStore.getState().values["1"]?.[0]?.color).toEqual([0, 1, 0]);
  });

  it("discards an abandoned partial edit on blur, reverting to the committed value", () => {
    useAppStore.setState({ values: {} });
    render(<ColorFields row={textRow} iter={0} />);
    const hexInput = screen.getByDisplayValue("#FF0000");
    fireEvent.change(hexInput, { target: { value: "#12" } });
    expect(hexInput).toHaveValue("#12");
    fireEvent.blur(hexInput);
    expect(hexInput).toHaveValue("#FF0000");
  });
});

describe("ColorFields — text row font field", () => {
  it("updates the store when the font field changes", () => {
    useAppStore.setState({ values: {} });
    render(<ColorFields row={textRow} iter={0} />);
    fireEvent.change(screen.getByPlaceholderText("PostScript name"), { target: { value: "Helvetica-Bold" } });
    expect(useAppStore.getState().values["1"]?.[0]?.font).toBe("Helvetica-Bold");
  });

  it("shows the FontInput autocomplete dropdown on focus, proving it's not the old plain input", async () => {
    useAppStore.setState({ values: {} });
    render(<ColorFields row={textRow} iter={0} />);
    fireEvent.focus(screen.getByPlaceholderText("PostScript name"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("Helvetica-Bold")).toBeInTheDocument();
  });
});
