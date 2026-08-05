import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogoSection } from "./LogoSection";
import { useAppStore } from "../state/store";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() => Promise.resolve({ path: "/tmp/preview.png", width: 1080, height: 1920 })),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

vi.mock("../lib/logoLibrary", () => ({
  listLogoFiles: vi.fn(() => ["/logos/brand-a.png"]),
  logoLibraryPath: vi.fn(() => "/logos"),
}));

describe("LogoSection", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: "Comp A", logoPath: null, logoX: 990, logoY: 90, logoSize: 100,
    });
  });

  it("selecting a logo from the grid writes its path into the store", () => {
    render(<LogoSection />);
    fireEvent.click(screen.getByTitle("brand-a.png"));
    expect(useAppStore.getState().logoPath).toBe("/logos/brand-a.png");
  });

  it("updates X/Y/Size fields independently", () => {
    render(<LogoSection />);
    const [xInput, yInput, sizeInput] = screen.getAllByRole("spinbutton");
    fireEvent.change(xInput, { target: { value: "500" } });
    fireEvent.change(yInput, { target: { value: "600" } });
    fireEvent.change(sizeInput, { target: { value: "80" } });
    expect(useAppStore.getState().logoX).toBe(500);
    expect(useAppStore.getState().logoY).toBe(600);
    expect(useAppStore.getState().logoSize).toBe(80);
  });

  it("opens the position picker on button click", async () => {
    render(<LogoSection />);
    fireEvent.click(screen.getByText("Position visually…"));
    expect(await screen.findByAltText("Comp preview")).toBeInTheDocument();
  });

  it("updates the Attach to layer field", () => {
    render(<LogoSection />);
    fireEvent.change(screen.getByText("Attach to layer").nextSibling as Element, { target: { value: "2" } });
    expect(useAppStore.getState().logoLayerIndex).toBe(2);
  });
});
