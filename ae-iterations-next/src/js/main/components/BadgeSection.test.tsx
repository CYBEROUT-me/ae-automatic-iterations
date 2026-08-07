import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BadgeSection } from "./BadgeSection";
import { useAppStore } from "../state/store";

vi.mock("../../lib/utils/bolt", () => ({
  // Real layers so LayerPicker renders its <select>; with an empty list it
  // falls back to a number input, which would collide with the size field.
  evalTS: vi.fn(() => Promise.resolve({ compName: "X_9x16", layers: [{ index: 1, name: "L1" }], candidates: ["X_9x16"] })),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

describe("BadgeSection", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: "Comp A", count: 3, mode: "var",
      badgeX: 90, badgeY: 90, badgeSize: 100,
      badgeCircleColor: [1, 1, 1], badgeTextColor: [0, 0, 0], badgeLayerIndex: 0,
    });
  });

  it("updates the size field", async () => {
    render(<BadgeSection />);
    // Wait for LayerPicker to resolve — until it does, its number-input
    // fallback is mounted and would collide with the size field.
    await screen.findByRole("combobox");
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "150" } });
    expect(useAppStore.getState().badgeSize).toBe(150);
  });

  it("updates circle and text colours independently", () => {
    render(<BadgeSection />);
    const [circle, text] = screen.getAllByDisplayValue(/^#/, { exact: false }) as HTMLInputElement[];
    fireEvent.change(circle, { target: { value: "#ff0000" } });
    fireEvent.change(text, { target: { value: "#00ff00" } });
    expect(useAppStore.getState().badgeCircleColor).toEqual([1, 0, 0]);
    expect(useAppStore.getState().badgeTextColor).toEqual([0, 1, 0]);
  });

  it("keeps the numeric X/Y behind a disclosure, and writes through when opened", async () => {
    render(<BadgeSection />);
    await screen.findByRole("combobox");
    expect(screen.queryByText("X")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Exact position"));
    const spinners = screen.getAllByRole("spinbutton");
    // [size, X, Y] once the disclosure is open.
    fireEvent.change(spinners[1], { target: { value: "300" } });
    fireEvent.change(spinners[2], { target: { value: "400" } });

    expect(useAppStore.getState().badgeX).toBe(300);
    expect(useAppStore.getState().badgeY).toBe(400);
  });

  it("no longer owns positioning or the per-variation rows", () => {
    // Both are shared with Logo and live in OverlaysCard now — a second
    // copy here is exactly what this restructure removed.
    render(<BadgeSection />);
    expect(screen.queryByText(/Position visually/)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Badge text")).not.toBeInTheDocument();
  });
});
