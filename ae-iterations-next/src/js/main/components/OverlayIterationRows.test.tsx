import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OverlayIterationRows } from "./OverlayIterationRows";
import { useAppStore } from "../state/store";

const base = {
  count: 3,
  badgeEnabled: false, badgeTexts: [], badgeEnabledPerIteration: [],
  logoEnabled: false, logoPerIteration: [],
  varNames: [],
};

describe("OverlayIterationRows", () => {
  beforeEach(() => useAppStore.setState(base));

  it("renders nothing when neither overlay is enabled", () => {
    const { container } = render(<OverlayIterationRows />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the badge column when only badge is on", () => {
    useAppStore.setState({ badgeEnabled: true });
    render(<OverlayIterationRows />);
    expect(screen.getByText("Badge text")).toBeInTheDocument();
    expect(screen.queryByText("Logo")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Badge text for variant/)).toHaveLength(3);
  });

  it("shows only the logo column when only logo is on", () => {
    useAppStore.setState({ logoEnabled: true });
    render(<OverlayIterationRows />);
    expect(screen.getByText("Logo")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Badge text for variant/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("puts both overlays on one row per variation when both are on", () => {
    useAppStore.setState({ badgeEnabled: true, logoEnabled: true });
    render(<OverlayIterationRows />);
    expect(screen.getByText("Badge text")).toBeInTheDocument();
    expect(screen.getByText("Logo")).toBeInTheDocument();
    // 3 variations × (badge on/off + logo on/off)
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.getAllByLabelText(/^Badge text for variant/)).toHaveLength(3);
  });

  it("writes badge text for the right variation", () => {
    useAppStore.setState({ badgeEnabled: true });
    render(<OverlayIterationRows />);
    fireEvent.change(screen.getAllByLabelText(/^Badge text for variant/)[1], { target: { value: "50%" } });
    expect(useAppStore.getState().badgeTexts[1]).toBe("50%");
    expect(useAppStore.getState().badgeTexts[0]).toBeUndefined();
  });

  it("toggles each overlay independently on the same variation", () => {
    useAppStore.setState({ badgeEnabled: true, logoEnabled: true });
    render(<OverlayIterationRows />);
    const boxes = screen.getAllByRole("checkbox");
    // Row 1 is [badge, logo]; untick only the logo.
    fireEvent.click(boxes[1]);
    expect(useAppStore.getState().logoPerIteration[0]).toBe(false);
    expect(useAppStore.getState().badgeEnabledPerIteration[0]).toBeUndefined();
  });

  it("follows the count", () => {
    useAppStore.setState({ badgeEnabled: true, count: 5 });
    render(<OverlayIterationRows />);
    expect(screen.getAllByLabelText(/^Badge text for variant/)).toHaveLength(5);
  });
});
