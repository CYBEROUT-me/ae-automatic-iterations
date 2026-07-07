import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VarNamesRow } from "./VarNamesRow";
import { useAppStore } from "../state/store";

describe("VarNamesRow", () => {
  beforeEach(() => {
    useAppStore.setState({ count: 3, varNames: [] });
  });

  it("renders one input per count", () => {
    render(<VarNamesRow />);
    expect(screen.getAllByPlaceholderText(/Name \d/)).toHaveLength(3);
  });

  it("updates the store when a name is typed", () => {
    render(<VarNamesRow />);
    const inputs = screen.getAllByPlaceholderText(/Name \d/);
    fireEvent.change(inputs[1], { target: { value: "Blue Variant" } });
    expect(useAppStore.getState().varNames[1]).toBe("Blue Variant");
  });
});
