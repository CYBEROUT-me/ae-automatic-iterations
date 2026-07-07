import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MediaFields } from "./MediaFields";
import { useAppStore } from "../state/store";
import type { RowLayer } from "../state/rowLayers";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() => Promise.resolve({ path: "/Users/test/movie.mov" })),
}));

const row: RowLayer = { layerIndex: 5, rowKey: "5", type: "media", name: "BG", fillPath: "" };

describe("MediaFields", () => {
  beforeEach(() => {
    useAppStore.setState({ values: {} });
  });

  it("shows 'No file' until a file is chosen", () => {
    render(<MediaFields row={row} iter={0} />);
    expect(screen.getByText("No file")).toBeInTheDocument();
  });

  it("updates the store and label after browsing", async () => {
    render(<MediaFields row={row} iter={0} />);
    fireEvent.click(screen.getByText("Browse…"));
    await new Promise((r) => setTimeout(r, 0));
    expect(useAppStore.getState().values["5"]?.[0]?.mediaPath).toBe("/Users/test/movie.mov");
    expect(screen.getByText("movie.mov")).toBeInTheDocument();
  });
});
