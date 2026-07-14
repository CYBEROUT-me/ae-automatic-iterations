import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FontInput } from "./FontInput";
import * as fontsLib from "../lib/fonts";

vi.mock("../lib/fonts", () => ({
  loadFonts: vi.fn(),
}));

describe("FontInput", () => {
  beforeEach(() => {
    vi.mocked(fontsLib.loadFonts).mockResolvedValue(["ArialMT", "Arial-BoldMT", "Helvetica"]);
  });

  it("shows 'Loading fonts…' before the font list resolves", () => {
    vi.mocked(fontsLib.loadFonts).mockReturnValue(new Promise(() => {}));
    render(<FontInput value="" onChange={() => {}} />);
    fireEvent.focus(screen.getByPlaceholderText("PostScript name"));
    expect(screen.getByText("Loading fonts…")).toBeInTheDocument();
  });

  it("filters the dropdown by the current value, case-insensitively", async () => {
    render(<FontInput value="arial" onChange={() => {}} />);
    fireEvent.focus(screen.getByPlaceholderText("PostScript name"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("ArialMT")).toBeInTheDocument();
    expect(screen.getByText("Arial-BoldMT")).toBeInTheDocument();
    expect(screen.queryByText("Helvetica")).not.toBeInTheDocument();
  });

  it("shows 'No fonts found' when nothing matches", async () => {
    render(<FontInput value="zzz-no-match" onChange={() => {}} />);
    fireEvent.focus(screen.getByPlaceholderText("PostScript name"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("No fonts found")).toBeInTheDocument();
  });

  it("calls onChange and closes the dropdown when a result is selected", async () => {
    const onChange = vi.fn();
    render(<FontInput value="arial" onChange={onChange} />);
    fireEvent.focus(screen.getByPlaceholderText("PostScript name"));
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.mouseDown(screen.getByText("ArialMT"));
    expect(onChange).toHaveBeenCalledWith("ArialMT");
    expect(screen.queryByText("Arial-BoldMT")).not.toBeInTheDocument();
  });

  it("calls onChange as the user types", () => {
    const onChange = vi.fn();
    render(<FontInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("PostScript name"), { target: { value: "Hel" } });
    expect(onChange).toHaveBeenCalledWith("Hel");
  });
});
