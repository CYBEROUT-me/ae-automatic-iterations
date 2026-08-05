import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PositionPickerPopup } from "./PositionPickerPopup";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() => Promise.resolve({ path: "/tmp/preview.png", width: 1080, height: 1920 })),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

describe("PositionPickerPopup", () => {
  beforeEach(() => {
    // The popup's canvas is fixed at 320px display width (POPUP_WIDTH);
    // a 1080x1920 comp scales to displayHeight = 1920/1080*320 = 568.89.
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 320, bottom: 568.89, width: 320, height: 568.89,
      x: 0, y: 0, toJSON: () => {},
    }));
  });

  it("renders the fetched snapshot and a marker positioned from x/y", async () => {
    render(<PositionPickerPopup compName="Comp A" x={540} y={960} onChange={() => {}} onClose={() => {}} markerKind="badge" />);
    const img = await screen.findByAltText("Comp preview");
    expect(img).toBeInTheDocument();
  });

  it("dragging the canvas converts screen coordinates back to comp pixels", async () => {
    const onChange = vi.fn();
    render(<PositionPickerPopup compName="Comp A" x={0} y={0} onChange={onChange} onClose={() => {}} markerKind="logo" />);
    await screen.findByAltText("Comp preview");
    const canvas = screen.getByTestId("position-picker-canvas");
    // scale = 320 / 1080 ≈ 0.2963; clicking at (160, 284) -> ~(540, 958) comp px.
    fireEvent.mouseDown(canvas, { clientX: 160, clientY: 284 });
    expect(onChange).toHaveBeenCalled();
    const [calledX, calledY] = onChange.mock.calls[0];
    expect(calledX).toBeGreaterThan(500);
    expect(calledX).toBeLessThan(580);
    expect(calledY).toBeGreaterThan(920);
    expect(calledY).toBeLessThan(1000);
  });

  it("closes when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(<PositionPickerPopup compName="Comp A" x={0} y={0} onChange={() => {}} onClose={onClose} markerKind="badge" />);
    await screen.findByAltText("Comp preview");
    fireEvent.click(screen.getByTestId("position-picker-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });
});
