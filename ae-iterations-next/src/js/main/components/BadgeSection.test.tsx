import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BadgeSection } from "./BadgeSection";
import { useAppStore } from "../state/store";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() => Promise.resolve({ path: "/tmp/preview.png", width: 1080, height: 1920 })),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

describe("BadgeSection", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: "Comp A", count: 3,
      badgeTexts: [], badgeX: 90, badgeY: 90, badgeSize: 100, badgeCircleColor: [1, 1, 1], badgeTextColor: [0, 0, 0],
    });
  });

  it("renders one free-text input per iteration and writes into the store", () => {
    render(<BadgeSection />);
    const inputs = screen.getAllByPlaceholderText("Badge text");
    expect(inputs).toHaveLength(3);
    fireEvent.change(inputs[0], { target: { value: "25+" } });
    expect(useAppStore.getState().badgeTexts[0]).toBe("25+");
  });

  it("updates X/Y/Size fields independently", () => {
    render(<BadgeSection />);
    const [xInput, yInput] = screen.getAllByRole("spinbutton").slice(0, 2);
    fireEvent.change(xInput, { target: { value: "150" } });
    fireEvent.change(yInput, { target: { value: "250" } });
    expect(useAppStore.getState().badgeX).toBe(150);
    expect(useAppStore.getState().badgeY).toBe(250);
  });

  it("opens the position picker on button click when a comp is set", async () => {
    render(<BadgeSection />);
    fireEvent.click(screen.getByText("Position visually…"));
    expect(await screen.findByAltText("Comp preview")).toBeInTheDocument();
  });

  it("opens the position picker even when no comp is set (relies on the active-comp fallback)", async () => {
    useAppStore.setState({ compName: null });
    render(<BadgeSection />);
    expect(screen.getByText("Position visually…")).not.toBeDisabled();
    fireEvent.click(screen.getByText("Position visually…"));
    expect(await screen.findByAltText("Comp preview")).toBeInTheDocument();
  });

  it("updates the Attach to layer field", () => {
    render(<BadgeSection />);
    fireEvent.change(screen.getByText("Attach to layer").nextSibling as Element, { target: { value: "4" } });
    expect(useAppStore.getState().badgeLayerIndex).toBe(4);
  });
});
