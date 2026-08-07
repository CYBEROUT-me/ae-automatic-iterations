import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JobPresetBar } from "./JobPresetBar";
import { useAppStore } from "../state/store";
import { loadPanelState, savePanelState } from "../lib/panelState";
import { emptyPanelState } from "../lib/panelState";

vi.mock("../lib/panelState", async () => {
  const actual = await vi.importActual<typeof import("../lib/panelState")>("../lib/panelState");
  return { ...actual, loadPanelState: vi.fn(), savePanelState: vi.fn(() => true) };
});

describe("JobPresetBar", () => {
  beforeEach(() => {
    vi.mocked(loadPanelState).mockReturnValue(emptyPanelState());
    vi.mocked(savePanelState).mockClear().mockReturnValue(true);
    useAppStore.setState({ mode: "var", count: 5, badgeEnabled: false, logoEnabled: false, varNames: [] });
  });

  it("shows an empty state when nothing is saved yet", () => {
    render(<JobPresetBar />);
    expect(screen.getByText("No saved setups yet")).toBeInTheDocument();
  });

  it("saves the current setup under a typed name", () => {
    vi.spyOn(window, "prompt").mockReturnValue("Client X promo");
    useAppStore.setState({ count: 3, badgeEnabled: true });
    render(<JobPresetBar />);
    fireEvent.click(screen.getByTitle("Save current setup"));

    expect(savePanelState).toHaveBeenCalled();
    const written = vi.mocked(savePanelState).mock.calls[0][0];
    expect(written.jobPresets).toHaveLength(1);
    expect(written.jobPresets[0].name).toBe("Client X promo");
    expect(written.jobPresets[0].setup.count).toBe(3);
    expect(written.jobPresets[0].setup.badgeEnabled).toBe(true);
  });

  it("does not save when the name prompt is cancelled or blank", () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<JobPresetBar />);
    fireEvent.click(screen.getByTitle("Save current setup"));
    expect(savePanelState).not.toHaveBeenCalled();

    promptSpy.mockReturnValue("   ");
    fireEvent.click(screen.getByTitle("Save current setup"));
    expect(savePanelState).not.toHaveBeenCalled();
  });

  it("loading a saved setup applies it to the store", () => {
    vi.mocked(loadPanelState).mockReturnValue({
      ...emptyPanelState(),
      jobPresets: [{ name: "Promo", setup: { count: 2, badgeEnabled: true, badgeX: 300 } }],
    });
    render(<JobPresetBar />);
    fireEvent.change(screen.getByTitle("Load a saved setup"), { target: { value: "Promo" } });

    const s = useAppStore.getState();
    expect(s.count).toBe(2);
    expect(s.badgeEnabled).toBe(true);
    expect(s.badgeX).toBe(300);
  });

  it("requires confirmation before replacing an existing setup of the same name", () => {
    vi.mocked(loadPanelState).mockReturnValue({
      ...emptyPanelState(),
      jobPresets: [{ name: "Promo", setup: { count: 9 } }],
    });
    vi.spyOn(window, "prompt").mockReturnValue("Promo");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<JobPresetBar />);
    fireEvent.click(screen.getByTitle("Save current setup"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(savePanelState).not.toHaveBeenCalled();
  });

  it("replaces rather than duplicating when the user confirms an overwrite", () => {
    vi.mocked(loadPanelState).mockReturnValue({
      ...emptyPanelState(),
      jobPresets: [{ name: "Promo", setup: { count: 9 } }],
    });
    vi.spyOn(window, "prompt").mockReturnValue("Promo");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    useAppStore.setState({ count: 4 });

    render(<JobPresetBar />);
    fireEvent.click(screen.getByTitle("Save current setup"));

    const written = vi.mocked(savePanelState).mock.calls[0][0];
    expect(written.jobPresets).toHaveLength(1);
    expect(written.jobPresets[0].setup.count).toBe(4);
  });

  it("deletes only the selected setup, after confirmation", () => {
    vi.mocked(loadPanelState).mockReturnValue({
      ...emptyPanelState(),
      jobPresets: [{ name: "A", setup: {} }, { name: "B", setup: {} }],
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<JobPresetBar />);
    fireEvent.change(screen.getByTitle("Load a saved setup"), { target: { value: "A" } });
    fireEvent.click(screen.getByTitle("Delete selected setup"));

    const written = vi.mocked(savePanelState).mock.calls[0][0];
    expect(written.jobPresets).toHaveLength(1);
    expect(written.jobPresets[0].name).toBe("B");
  });

  it("preserves the autosaved session when writing presets", () => {
    // Both features share one file; a preset write must not drop the
    // session autosave that landed in between.
    vi.mocked(loadPanelState).mockReturnValue({ ...emptyPanelState(), lastSession: { count: 7 } });
    vi.spyOn(window, "prompt").mockReturnValue("New");
    render(<JobPresetBar />);
    fireEvent.click(screen.getByTitle("Save current setup"));

    expect(vi.mocked(savePanelState).mock.calls[0][0].lastSession).toEqual({ count: 7 });
  });
});
