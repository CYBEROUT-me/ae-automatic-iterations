import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RunButton } from "./RunButton";
import { useAppStore } from "../state/store";
import { evalTS } from "../../lib/utils/bolt";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

vi.mock("../lib/runProgress", () => ({ readRunProgress: vi.fn(() => "") }));

// Mirrors the host command surface: varRunBegin reports how many variants
// there are, each varRunStep returns that variant's warnings, varRunEnd
// unwinds. Per-command overrides let a single test make one step fail.
function mockHost(total: number, overrides: Record<string, unknown> = {}) {
  vi.mocked(evalTS).mockImplementation(((name: string) => {
    if (name in overrides) {
      const value = overrides[name];
      if (value instanceof Error) return Promise.reject(value);
      return Promise.resolve(value);
    }
    if (name === "varRunBegin") return Promise.resolve({ total, progressPath: "/tmp/p.txt" });
    if (name === "varRunStep") return Promise.resolve({ warnings: [] });
    if (name === "varRunEnd") return Promise.resolve({ warnings: [] });
    return Promise.resolve({ warnings: [] });
  }) as never);
}

const calledCommands = () => vi.mocked(evalTS).mock.calls.map((c) => c[0]);

describe("RunButton — VAR duplicate variant name guard", () => {
  beforeEach(() => {
    vi.mocked(evalTS).mockReset();
    mockHost(3);
    useAppStore.setState({
      compName: "Comp A", rowLayers: [], count: 3, mode: "var", varNames: [],
      badgeEnabled: false, logoEnabled: false,
    });
  });

  it("blocks the run and reports the colliding name when two typed names match", () => {
    useAppStore.setState({ varNames: ["Same", "Same", "Other"] });
    render(<RunButton effectiveValue={() => ({})} />);
    fireEvent.click(screen.getByText("Run VAR"));
    expect(screen.getByText(/Duplicate variant name: Same/)).toBeInTheDocument();
    expect(evalTS).not.toHaveBeenCalled();
  });

  it("blocks when a typed name collides with another slot's default fallback", () => {
    useAppStore.setState({ varNames: ["VAR2", "", "Other"] });
    render(<RunButton effectiveValue={() => ({})} />);
    fireEvent.click(screen.getByText("Run VAR"));
    expect(screen.getByText(/Duplicate variant name: VAR2/)).toBeInTheDocument();
    expect(evalTS).not.toHaveBeenCalled();
  });
});

describe("RunButton — chunked VAR run", () => {
  beforeEach(() => {
    vi.mocked(evalTS).mockReset();
    useAppStore.setState({
      compName: "Comp A", rowLayers: [], count: 3, mode: "var",
      varNames: ["A", "B", "C"], badgeEnabled: false, logoEnabled: false,
    });
  });

  it("runs one step per variant, then unwinds", async () => {
    mockHost(3);
    render(<RunButton effectiveValue={() => ({})} />);
    fireEvent.click(screen.getByText("Run VAR"));

    await waitFor(() => expect(screen.getByText(/Done — 3 variants complete/)).toBeInTheDocument());
    expect(calledCommands()).toEqual(["varRunBegin", "varRunStep", "varRunStep", "varRunStep", "varRunEnd"]);
  });

  it("passes the variant index to each step", async () => {
    mockHost(3);
    render(<RunButton effectiveValue={() => ({})} />);
    fireEvent.click(screen.getByText("Run VAR"));

    await waitFor(() => expect(screen.getByText(/Done/)).toBeInTheDocument());
    const stepArgs = vi.mocked(evalTS).mock.calls.filter((c) => c[0] === "varRunStep").map((c) => c[1]);
    expect(stepArgs).toEqual([0, 1, 2]);
  });

  it("aggregates warnings from individual steps", async () => {
    mockHost(2, { varRunStep: { warnings: ["something odd"] } });
    render(<RunButton effectiveValue={() => ({})} />);
    fireEvent.click(screen.getByText("Run VAR"));

    await waitFor(() => expect(screen.getByText(/something odd/)).toBeInTheDocument());
    expect(screen.getByText(/Finished 2\/2/)).toBeInTheDocument();
  });

  it("still unwinds when a step throws, rather than leaking the temp project", async () => {
    mockHost(3, { varRunStep: new Error("boom") });
    render(<RunButton effectiveValue={() => ({})} />);
    fireEvent.click(screen.getByText("Run VAR"));

    await waitFor(() => expect(screen.getByText(/Run stopped: Error: boom/)).toBeInTheDocument());
    expect(calledCommands()).toContain("varRunEnd");
  });

  it("Cancel stops before the next variant and reports how far it got", async () => {
    // Resolve each step only when we say so, so the run is reliably still
    // in flight when Cancel is clicked.
    let releaseStep: (v: unknown) => void = () => {};
    vi.mocked(evalTS).mockImplementation(((name: string) => {
      if (name === "varRunBegin") return Promise.resolve({ total: 5, progressPath: "/tmp/p.txt" });
      if (name === "varRunStep") return new Promise((res) => { releaseStep = res; });
      return Promise.resolve({ warnings: [] });
    }) as never);

    render(<RunButton effectiveValue={() => ({})} />);
    fireEvent.click(screen.getByText("Run VAR"));

    const cancel = await screen.findByText("Cancel");
    fireEvent.click(cancel);
    releaseStep({ warnings: [] });

    await waitFor(() => expect(screen.getByText(/Cancelled after 1 of 5 variants/)).toBeInTheDocument());
    expect(calledCommands().filter((c) => c === "varRunStep")).toHaveLength(1);
    expect(calledCommands()).toContain("varRunEnd");
  });

  it("shows no Cancel button when idle", () => {
    mockHost(3);
    render(<RunButton effectiveValue={() => ({})} />);
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });
});
