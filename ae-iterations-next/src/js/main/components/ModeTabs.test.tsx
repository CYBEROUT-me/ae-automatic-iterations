import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModeTabs } from "./ModeTabs";
import { useAppStore } from "../state/store";

describe("ModeTabs", () => {
  beforeEach(() => {
    useAppStore.setState({ mode: "itr" });
  });

  it("starts with ITR active", () => {
    render(<ModeTabs />);
    expect(screen.getByText("ITR").className).toContain("active");
    expect(screen.getByText("VAR").className).not.toContain("active");
  });

  it("switches mode when VAR is clicked", () => {
    render(<ModeTabs />);
    fireEvent.click(screen.getByText("VAR"));
    expect(useAppStore.getState().mode).toBe("var");
    expect(screen.getByText("VAR").className).toContain("active");
    expect(screen.getByText("ITR").className).not.toContain("active");
  });

  it("switches back to ITR when clicked", () => {
    useAppStore.getState().setMode("var");
    render(<ModeTabs />);
    fireEvent.click(screen.getByText("ITR"));
    expect(useAppStore.getState().mode).toBe("itr");
  });
});
