import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IterationRow } from "./IterationRow";
import { useAppStore } from "../state/store";
import type { RowLayer } from "../state/rowLayers";

// A text row now renders ColorFields' FontInput, which imports the real
// fonts.ts. That module breaks under this file's default jsdom environment
// (see fonts.test.ts's file-level comment: importing Node's "path" under
// jsdom resolves to a stray legacy npm package instead of the builtin) —
// mocked here the same way ColorFields.test.tsx and FontInput.test.tsx
// already do, since this file isn't testing font-loading behavior.
vi.mock("../lib/fonts", () => ({
  loadFonts: vi.fn().mockResolvedValue([]),
}));

describe("IterationRow", () => {
  it("shows font and content inputs for a text row, not for a shape row", () => {
    const textRow: RowLayer = { layerIndex: 1, rowKey: "1", type: "text", name: "Title", fillPath: "" };
    render(<IterationRow row={textRow} iter={0} />);
    expect(screen.getByPlaceholderText("PostScript name")).toBeInTheDocument();

    const shapeRow: RowLayer = { layerIndex: 2, rowKey: "2", type: "shape", name: "Rect", fillPath: "Contents/Fill 1" };
    render(<IterationRow row={shapeRow} iter={0} />);
    expect(screen.queryAllByPlaceholderText("PostScript name")).toHaveLength(1); // still just the text row's
  });

  it("updates the store when a hex input changes", () => {
    const shapeRow: RowLayer = { layerIndex: 3, rowKey: "3", type: "shape", name: "Rect", fillPath: "Contents/Fill 1" };
    render(<IterationRow row={shapeRow} iter={0} />);
    const hexInput = screen.getAllByDisplayValue("#FF0000")[0];
    fireEvent.change(hexInput, { target: { value: "#00FF00" } });
    expect(useAppStore.getState().values["3"]?.[0]?.color).toEqual([0, 1, 0]);
  });
});
