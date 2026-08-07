import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PositionPickerPopup } from "./PositionPickerPopup";
import { useAppStore } from "../state/store";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() => Promise.resolve({ path: "/tmp/preview.png", width: 1080, height: 1920 })),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

// scale = 320 (POPUP_WIDTH) / 1080 ≈ 0.296296 — comp px * scale = screen px.
const SCALE = 320 / 1080;

function setStore(over: Partial<ReturnType<typeof useAppStore.getState>> = {}) {
  useAppStore.setState({
    compName: "Comp A",
    badgeEnabled: true, badgeX: 200, badgeY: 400, badgeSize: 100,
    badgeTexts: ["25+"], badgeCircleColor: [1, 1, 1], badgeTextColor: [0, 0, 0],
    logoEnabled: false, logoPath: "/logos/brand-a.png", logoX: 800, logoY: 1200, logoSize: 100,
    ...over,
  });
}

const loadLogo = (img: HTMLImageElement, w = 400, h = 200) => {
  Object.defineProperty(img, "naturalWidth", { value: w, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: h, configurable: true });
  fireEvent.load(img);
};

describe("PositionPickerPopup", () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 320, bottom: 568.89, width: 320, height: 568.89,
      x: 0, y: 0, toJSON: () => {},
    }));
    setStore();
  });

  it("renders the fetched snapshot", async () => {
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    expect(await screen.findByAltText("Comp preview")).toBeInTheDocument();
  });

  it("renders a real badge preview using the configured text", async () => {
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");
    expect(screen.getByText("25+")).toBeInTheDocument();
  });

  it("shows both overlays on one canvas when both are enabled", async () => {
    setStore({ logoEnabled: true });
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");
    expect(screen.getByTestId("overlay-badge")).toBeInTheDocument();
    expect(screen.getByTestId("overlay-logo")).toBeInTheDocument();
  });

  it("shows only the enabled overlay when the other is off", async () => {
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");
    expect(screen.getByTestId("overlay-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("overlay-logo")).not.toBeInTheDocument();
  });

  it("dragging the canvas converts screen coordinates back to comp pixels", async () => {
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");
    fireEvent.mouseDown(screen.getByTestId("position-picker-canvas"), { clientX: 160, clientY: 284 });
    const s = useAppStore.getState();
    expect(s.badgeX).toBeGreaterThan(500);
    expect(s.badgeX).toBeLessThan(580);
    expect(s.badgeY).toBeGreaterThan(920);
    expect(s.badgeY).toBeLessThan(1000);
  });

  it("moves only the selected overlay, leaving the other alone", async () => {
    setStore({ logoEnabled: true });
    render(<PositionPickerPopup focus="logo" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");
    fireEvent.mouseDown(screen.getByTestId("position-picker-canvas"), { clientX: 100, clientY: 100 });
    const s = useAppStore.getState();
    expect(s.logoX).not.toBe(800);
    expect(s.badgeX).toBe(200);
    expect(s.badgeY).toBe(400);
  });

  it("holding Shift constrains the drag to a single axis", async () => {
    setStore({ badgeX: 200, badgeY: 400 });
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");

    // Grab the badge itself so the drag records its start position, then
    // move mostly horizontally with Shift held — Y must not budge.
    fireEvent.mouseDown(screen.getByTestId("overlay-badge"), { clientX: 200 * SCALE, clientY: 400 * SCALE });
    fireEvent.mouseMove(window, { clientX: 300 * SCALE, clientY: 420 * SCALE, shiftKey: true });

    const s = useAppStore.getState();
    expect(s.badgeY).toBe(400);
    expect(s.badgeX).toBeGreaterThan(250);
  });

  it("snaps to the other overlay's axis when dragged close to it", async () => {
    // Logo sits at y=1200. Dragging the badge to y≈1205 is within the
    // snap threshold, so it should land exactly on 1200 and show a guide.
    setStore({ logoEnabled: true, logoX: 800, logoY: 1200, badgeX: 200, badgeY: 400 });
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");

    fireEvent.mouseDown(screen.getByTestId("overlay-badge"), { clientX: 200 * SCALE, clientY: 400 * SCALE });
    fireEvent.mouseMove(window, { clientX: 300 * SCALE, clientY: 1205 * SCALE });

    expect(useAppStore.getState().badgeY).toBe(1200);
    expect(screen.getByTestId("align-guide-y")).toBeInTheDocument();
  });

  it("does not snap when the other overlay is far away", async () => {
    setStore({ logoEnabled: true, logoX: 800, logoY: 1200, badgeX: 200, badgeY: 400 });
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");

    fireEvent.mouseDown(screen.getByTestId("overlay-badge"), { clientX: 200 * SCALE, clientY: 400 * SCALE });
    fireEvent.mouseMove(window, { clientX: 300 * SCALE, clientY: 600 * SCALE });

    expect(useAppStore.getState().badgeY).toBe(600);
    expect(screen.queryByTestId("align-guide-y")).not.toBeInTheDocument();
  });

  it("lets the user switch which overlay is being positioned", async () => {
    setStore({ logoEnabled: true });
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");

    fireEvent.click(screen.getByText("Logo"));
    fireEvent.mouseDown(screen.getByTestId("position-picker-canvas"), { clientX: 100, clientY: 100 });

    expect(useAppStore.getState().logoX).not.toBe(800);
    expect(useAppStore.getState().badgeX).toBe(200);
  });

  it("corner-snap buttons jump the selected overlay to a margin-inset corner", async () => {
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");
    fireEvent.click(screen.getByText("BR"));
    const s = useAppStore.getState();
    expect(s.badgeX).toBe(1080 - 80);
    expect(s.badgeY).toBe(1920 - 80);
  });

  it("dragging the resize handle changes the selected overlay's size", async () => {
    setStore({ badgeX: 200, badgeY: 400, badgeSize: 100 });
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");

    fireEvent.mouseDown(screen.getByTestId("position-picker-resize-handle"));
    fireEvent.mouseMove(window, { clientX: 200 * SCALE + 40 });

    expect(useAppStore.getState().badgeSize).not.toBe(100);
  });

  it("shows a logo placeholder until its image reports natural dimensions", async () => {
    setStore({ badgeEnabled: false, logoEnabled: true });
    render(<PositionPickerPopup focus="logo" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");

    const img = screen.getByAltText("Logo preview") as HTMLImageElement;
    expect(img.style.visibility).toBe("hidden");
    loadLogo(img);
    expect(img.style.visibility).not.toBe("hidden");
    expect(img.style.width).not.toBe("0px");
  });

  it("explains itself when neither overlay is enabled", async () => {
    setStore({ badgeEnabled: false, logoEnabled: false });
    render(<PositionPickerPopup focus="badge" onClose={() => {}} />);
    await screen.findByAltText("Comp preview");
    expect(screen.getByText(/Enable Badge or Logo/)).toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(<PositionPickerPopup focus="badge" onClose={onClose} />);
    await screen.findByAltText("Comp preview");
    fireEvent.click(screen.getByTestId("position-picker-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });
});
