import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RunButton } from "./RunButton";
import { useAppStore } from "../state/store";
import { evalTS } from "../../lib/utils/bolt";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() => Promise.resolve({ warnings: [] })),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

describe("RunButton — VAR duplicate variant name guard", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: "Comp A", rowLayers: [], count: 3, mode: "var", varNames: [],
      badgeEnabled: false, logoEnabled: false,
    });
    vi.mocked(evalTS).mockClear();
  });

  it("blocks the run and reports the colliding name when two typed variant names match", () => {
    useAppStore.setState({ varNames: ["Same", "Same", "Other"] });
    render(<RunButton effectiveValue={() => ({})} />);
    fireEvent.click(screen.getByText("Run VAR"));
    expect(screen.getByText(/Duplicate variant name: Same/)).toBeInTheDocument();
    expect(evalTS).not.toHaveBeenCalled();
  });

  it("blocks the run when a typed name collides with another slot's default fallback", () => {
    // Slot 2 (index 1) is left blank, so it defaults to "VAR2" -- typing
    // that exact string into slot 1 collides with it.
    useAppStore.setState({ varNames: ["VAR2", "", "Other"] });
    render(<RunButton effectiveValue={() => ({})} />);
    fireEvent.click(screen.getByText("Run VAR"));
    expect(screen.getByText(/Duplicate variant name: VAR2/)).toBeInTheDocument();
    expect(evalTS).not.toHaveBeenCalled();
  });

  it("runs normally when all variant names are unique", () => {
    useAppStore.setState({ varNames: ["Alpha", "Beta", "Gamma"] });
    render(<RunButton effectiveValue={() => ({})} />);
    fireEvent.click(screen.getByText("Run VAR"));
    expect(evalTS).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Duplicate/)).not.toBeInTheDocument();
  });
});
