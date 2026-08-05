import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VarNamesRow } from "./VarNamesRow";
import { useAppStore } from "../state/store";

describe("VarNamesRow", () => {
  beforeEach(() => {
    useAppStore.setState({ count: 3, varNames: [] });
  });

  it("renders one input per count", () => {
    render(<VarNamesRow onPreview={() => {}} />);
    expect(screen.getAllByPlaceholderText(/Name \d/)).toHaveLength(3);
  });

  it("updates the store when a name is typed", () => {
    render(<VarNamesRow onPreview={() => {}} />);
    const inputs = screen.getAllByPlaceholderText(/Name \d/);
    fireEvent.change(inputs[1], { target: { value: "Blue Variant" } });
    expect(useAppStore.getState().varNames[1]).toBe("Blue Variant");
  });

  it("calls onPreview with the row's iteration index when its Play button is clicked", () => {
    const onPreview = vi.fn();
    render(<VarNamesRow onPreview={onPreview} />);
    const buttons = screen.getAllByTitle(/Preview variant \d/);
    expect(buttons).toHaveLength(3);
    fireEvent.click(buttons[1]);
    expect(onPreview).toHaveBeenCalledWith(1);
  });
});
