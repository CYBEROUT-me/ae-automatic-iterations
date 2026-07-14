import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorFields } from "./ColorFields";
import { useAppStore } from "../state/store";
import type { RowLayer } from "../state/rowLayers";

vi.mock("../lib/fonts", () => ({
  loadFonts: vi.fn().mockResolvedValue(["Helvetica-Bold", "ArialMT"]),
}));

const textRow: RowLayer = { layerIndex: 1, rowKey: "1", type: "text", name: "Title", fillPath: "" };

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
