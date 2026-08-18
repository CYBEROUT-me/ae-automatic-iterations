import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OverlaysCard } from "./OverlaysCard";
import { useAppStore } from "../state/store";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn((cmd: string) =>
    cmd === "renderPreviewFrame"
      ? Promise.resolve({ path: "/tmp/preview.png", width: 1080, height: 1920 })
      : Promise.resolve({ compName: "", layers: [], candidates: [] })
  ),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

vi.mock("../lib/logoLibrary", () => ({
  listLogoFiles: vi.fn(() => ["/logos/brand-a.png"]),
  logoLibraryPath: vi.fn(() => "/logos"),
}));

describe("OverlaysCard", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: "Comp A", count: 2, mode: "var",
      badgeEnabled: false, badgeTexts: [], badgeEnabledPerIteration: [], badgeLayerIndex: 0,
      badgeX: 90, badgeY: 90, badgeSize: 100, badgeCircleColor: [1, 1, 1], badgeTextColor: [0, 0, 0],
      logoEnabled: false, logoPath: null, logoPerIteration: [], logoLayerIndex: 0,
      logoX: 990, logoY: 90, logoSize: 100,
    });
  });

  it("offers exactly one Position button, not one per overlay", () => {
    useAppStore.setState({ badgeEnabled: true, logoEnabled: true });
    render(<OverlaysCard />);
    expect(screen.getAllByText(/Position visually/)).toHaveLength(1);
  });

  it("hides positioning entirely until an overlay is enabled", () => {
    render(<OverlaysCard />);
    expect(screen.queryByText(/Position visually/)).not.toBeInTheDocument();
  });

  it("enabling an overlay shows a summary, not the whole settings block", () => {
    render(<OverlaysCard />);
    expect(document.getElementById("badge-section")).toBeNull();

    fireEvent.click(screen.getByTitle("Badge overlay"));
    expect(useAppStore.getState().badgeEnabled).toBe(true);
    // Collapsed by default — these are set once per job, so they shouldn't
    // occupy the panel permanently.
    expect(document.getElementById("badge-section")).toBeNull();
    expect(screen.getByTitle("Show badge settings")).toBeInTheDocument();
  });

  it("the collapsed summary reports the configured values", () => {
    useAppStore.setState({ badgeEnabled: true, badgeSize: 150, badgeLayerIndex: 2 });
    render(<OverlaysCard />);
    // Collapsing must not hide WHAT was configured, or it just costs a click
    // to find out.
    expect(screen.getByTitle("Show badge settings").textContent).toContain("150");
    expect(screen.getByTitle("Show badge settings").textContent).toContain("layer 2");
  });

  it("says 'top of stack' rather than layer 0 in the summary", () => {
    useAppStore.setState({ logoEnabled: true, logoLayerIndex: 0, logoPath: "/logos/brand-a.png", logoSize: 10 });
    render(<OverlaysCard />);
    const summary = screen.getByTitle("Show logo settings").textContent || "";
    expect(summary).toContain("top of stack");
    expect(summary).toContain("brand-a.png");
  });

  it("expands one overlay's settings without expanding the other", () => {
    useAppStore.setState({ badgeEnabled: true, logoEnabled: true, logoPath: "/logos/brand-a.png" });
    render(<OverlaysCard />);

    fireEvent.click(screen.getByTitle("Show badge settings"));
    expect(document.getElementById("badge-section")).not.toBeNull();
    expect(document.getElementById("logo-section")).toBeNull();
  });

  it("opens the shared picker from the single button", async () => {
    useAppStore.setState({ badgeEnabled: true });
    render(<OverlaysCard />);
    fireEvent.click(screen.getByText(/Position visually/));
    expect(await screen.findByAltText("Comp preview")).toBeInTheDocument();
  });

  it("focuses the picker on logo when badge is off", async () => {
    useAppStore.setState({ logoEnabled: true, logoPath: "/logos/brand-a.png" });
    render(<OverlaysCard />);
    fireEvent.click(screen.getByText(/Position visually/));
    await screen.findByAltText("Comp preview");
    // With only logo enabled it's the only overlay on the canvas.
    expect(screen.getByTestId("overlay-logo")).toBeInTheDocument();
    expect(screen.queryByTestId("overlay-badge")).not.toBeInTheDocument();
  });

  it("shows the shared per-variation table once an overlay is on", () => {
    useAppStore.setState({ badgeEnabled: true });
    render(<OverlaysCard />);
    expect(screen.getAllByLabelText(/^Badge text for variant/)).toHaveLength(2);
  });
});
