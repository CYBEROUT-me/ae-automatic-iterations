import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LayerPicker } from "./LayerPicker";
import { useAppStore } from "../state/store";
import { evalTS } from "../../lib/utils/bolt";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

const LAYERS = [
  { index: 1, name: "LO_packshot.mp4" },
  { index: 2, name: "icon logo.png" },
  { index: 3, name: "background" },
];

describe("LayerPicker", () => {
  beforeEach(() => {
    vi.mocked(evalTS).mockReset();
    useAppStore.setState({ mode: "var", compName: "Comp A" });
  });

  it("lists real layer names once the host responds", async () => {
    vi.mocked(evalTS).mockResolvedValue({ compName: "X_VAR_9x16", layers: LAYERS } as never);
    render(<LayerPicker value={0} onChange={() => {}} />);

    await waitFor(() => expect(screen.getByText("2 — icon logo.png")).toBeInTheDocument());
    expect(screen.getByText("1 — LO_packshot.mp4")).toBeInTheDocument();
    expect(screen.getByText("Top of stack")).toBeInTheDocument();
  });

  it("reports the chosen layer's index, not its name", async () => {
    vi.mocked(evalTS).mockResolvedValue({ compName: "X", layers: LAYERS } as never);
    const onChange = vi.fn();
    render(<LayerPicker value={0} onChange={onChange} />);

    await waitFor(() => expect(screen.getByText("2 — icon logo.png")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("treats Top of stack as index 0", async () => {
    vi.mocked(evalTS).mockResolvedValue({ compName: "X", layers: LAYERS } as never);
    const onChange = vi.fn();
    render(<LayerPicker value={2} onChange={onChange} />);

    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("flags a stored index that no longer matches any layer", async () => {
    // A restored session or a changed project can leave an index pointing
    // at nothing — that must be visible, not silently shown as some other
    // layer.
    vi.mocked(evalTS).mockResolvedValue({ compName: "X", layers: LAYERS } as never);
    render(<LayerPicker value={9} onChange={() => {}} />);

    await waitFor(() => expect(screen.getByText("9 — (no such layer)")).toBeInTheDocument());
  });

  it("falls back to a number input when the host returns no layers", async () => {
    vi.mocked(evalTS).mockResolvedValue({ compName: "", layers: [] } as never);
    render(<LayerPicker value={2} onChange={() => {}} />);

    await waitFor(() => expect(screen.getByRole("spinbutton")).toHaveValue(2));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("falls back to a number input when the host call fails outright", async () => {
    vi.mocked(evalTS).mockRejectedValue(new Error("no comp"));
    const onChange = vi.fn();
    render(<LayerPicker value={0} onChange={onChange} />);

    await waitFor(() => expect(screen.getByRole("spinbutton")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "4" } });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("asks the host for the mode's own target comp", async () => {
    vi.mocked(evalTS).mockResolvedValue({ compName: "X", layers: LAYERS } as never);
    useAppStore.setState({ mode: "itr" });
    render(<LayerPicker value={0} onChange={() => {}} />);

    await waitFor(() => expect(evalTS).toHaveBeenCalledWith("listOverlayLayers", "itr"));
  });
});
