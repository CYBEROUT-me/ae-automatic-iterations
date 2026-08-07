import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogoSection } from "./LogoSection";
import { useAppStore } from "../state/store";

vi.mock("../../lib/utils/bolt", () => ({
  // Real layers so LayerPicker renders its <select>; with an empty list it
  // falls back to a number input, which would collide with the size field.
  evalTS: vi.fn(() => Promise.resolve({ compName: "X_9x16", layers: [{ index: 1, name: "L1" }], candidates: ["X_9x16"] })),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

vi.mock("../lib/logoLibrary", () => ({
  listLogoFiles: vi.fn(() => ["/logos/brand-a.png"]),
  logoLibraryPath: vi.fn(() => "/logos"),
}));

describe("LogoSection", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: "Comp A", count: 3, mode: "var",
      logoPath: null, logoX: 990, logoY: 90, logoSize: 100, logoLayerIndex: 0,
    });
  });

  it("selecting a logo from the grid writes its path into the store", () => {
    render(<LogoSection />);
    fireEvent.click(screen.getByTitle("brand-a.png"));
    expect(useAppStore.getState().logoPath).toBe("/logos/brand-a.png");
  });

  it("updates the size field", async () => {
    render(<LogoSection />);
    // Wait for LayerPicker to resolve — until it does, its number-input
    // fallback is mounted and would collide with the size field.
    await screen.findByRole("combobox");
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "25" } });
    expect(useAppStore.getState().logoSize).toBe(25);
  });

  it("keeps the numeric X/Y behind a disclosure, and writes through when opened", async () => {
    render(<LogoSection />);
    await screen.findByRole("combobox");
    expect(screen.queryByText("X")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Exact position"));
    const spinners = screen.getAllByRole("spinbutton");
    fireEvent.change(spinners[1], { target: { value: "500" } });
    fireEvent.change(spinners[2], { target: { value: "600" } });

    expect(useAppStore.getState().logoX).toBe(500);
    expect(useAppStore.getState().logoY).toBe(600);
  });

  it("no longer owns positioning or the per-variation rows", () => {
    render(<LogoSection />);
    expect(screen.queryByText(/Position visually/)).not.toBeInTheDocument();
    expect(screen.queryByText("Apply logo")).not.toBeInTheDocument();
  });
});
