import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PositionPickerPopup } from "./PositionPickerPopup";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() => Promise.resolve({ path: "/tmp/preview.png", width: 1080, height: 1920 })),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

const BADGE_OVERLAY = {
  kind: "badge" as const,
  text: "25+",
  size: 100,
  circleColor: [1, 1, 1] as [number, number, number],
  textColor: [0, 0, 0] as [number, number, number],
};

const LOGO_OVERLAY = { kind: "logo" as const, size: 100, imagePath: "/logos/brand-a.png" };

describe("PositionPickerPopup", () => {
  beforeEach(() => {
    // The popup's canvas is fixed at 320px display width (POPUP_WIDTH);
    // a 1080x1920 comp scales to displayHeight = 1920/1080*320 = 568.89,
    // and scale = 320/1080 ≈ 0.296296.
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 320, bottom: 568.89, width: 320, height: 568.89,
      x: 0, y: 0, toJSON: () => {},
    }));
  });

  it("renders the fetched snapshot", async () => {
    render(<PositionPickerPopup compName="Comp A" x={540} y={960} onChange={() => {}} onSizeChange={() => {}} onClose={() => {}} overlay={BADGE_OVERLAY} />);
    expect(await screen.findByAltText("Comp preview")).toBeInTheDocument();
  });

  it("renders a real badge preview sized by the configured size percentage", async () => {
    render(<PositionPickerPopup compName="Comp A" x={540} y={960} onChange={() => {}} onSizeChange={() => {}} onClose={() => {}} overlay={BADGE_OVERLAY} />);
    await screen.findByAltText("Comp preview");
    expect(screen.getByText("25+")).toBeInTheDocument();
  });

  it("shows a placeholder marker for logo until the image loads, then the real image sized by size%", async () => {
    render(<PositionPickerPopup compName="Comp A" x={0} y={0} onChange={() => {}} onSizeChange={() => {}} onClose={() => {}} overlay={LOGO_OVERLAY} />);
    await screen.findByAltText("Comp preview");
    const img = screen.getByAltText("Logo preview") as HTMLImageElement;
    expect(img.style.visibility).toBe("hidden");
    Object.defineProperty(img, "naturalWidth", { value: 400, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 200, configurable: true });
    fireEvent.load(img);
    expect(img.style.visibility).not.toBe("hidden");
    expect(img.style.width).not.toBe("0px");
  });

  it("dragging the canvas converts screen coordinates back to comp pixels", async () => {
    const onChange = vi.fn();
    render(<PositionPickerPopup compName="Comp A" x={0} y={0} onChange={onChange} onSizeChange={() => {}} onClose={() => {}} overlay={LOGO_OVERLAY} />);
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

  it("corner-snap buttons jump to a margin-inset corner of the comp", async () => {
    const onChange = vi.fn();
    render(<PositionPickerPopup compName="Comp A" x={0} y={0} onChange={onChange} onSizeChange={() => {}} onClose={() => {}} overlay={BADGE_OVERLAY} />);
    await screen.findByAltText("Comp preview");
    fireEvent.click(screen.getByText("TR"));
    expect(onChange).toHaveBeenCalledWith(1000, 80); // 1080 - 80px margin, 80px margin
  });

  it("dragging the badge resize handle changes size proportionally to the drag distance", async () => {
    const onSizeChange = vi.fn();
    render(
      <PositionPickerPopup
        compName="Comp A" x={540} y={960} onChange={() => {}} onSizeChange={onSizeChange} onClose={() => {}} overlay={BADGE_OVERLAY}
      />
    );
    await screen.findByAltText("Comp preview");
    const handle = screen.getByTestId("position-picker-resize-handle");
    fireEvent.mouseDown(handle, { clientX: 175, clientY: 285 });
    // dx = 200 - rect.left(0) - x*scale(160) = 40; newSize = (40/scale/50)*100 = 270.
    fireEvent.mouseMove(window, { clientX: 200, clientY: 285 });
    expect(onSizeChange).toHaveBeenCalledWith(270);
  });

  it("shows the resize handle for logo only once the image has loaded, and dragging it changes size", async () => {
    const onSizeChange = vi.fn();
    render(
      <PositionPickerPopup
        compName="Comp A" x={0} y={0} onChange={() => {}} onSizeChange={onSizeChange} onClose={() => {}} overlay={LOGO_OVERLAY}
      />
    );
    await screen.findByAltText("Comp preview");
    expect(screen.queryByTestId("position-picker-resize-handle")).not.toBeInTheDocument();
    const img = screen.getByAltText("Logo preview") as HTMLImageElement;
    Object.defineProperty(img, "naturalWidth", { value: 400, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 200, configurable: true });
    fireEvent.load(img);
    const handle = screen.getByTestId("position-picker-resize-handle");
    fireEvent.mouseDown(handle, { clientX: 0, clientY: 0 });
    // baseHalfWidth = 400/2 = 200; x=0 -> center screen x = 0; dx = 50.
    // newSize = (50/scale/200)*100 ≈ 84.375 -> rounds to 84.
    fireEvent.mouseMove(window, { clientX: 50, clientY: 0 });
    expect(onSizeChange).toHaveBeenCalledWith(84);
  });

  it("closes when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(<PositionPickerPopup compName="Comp A" x={0} y={0} onChange={() => {}} onSizeChange={() => {}} onClose={onClose} overlay={BADGE_OVERLAY} />);
    await screen.findByAltText("Comp preview");
    fireEvent.click(screen.getByTestId("position-picker-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });
});
