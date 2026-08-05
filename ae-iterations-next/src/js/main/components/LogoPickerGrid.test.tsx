import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogoPickerGrid } from "./LogoPickerGrid";

vi.mock("../lib/logoLibrary", () => ({
  listLogoFiles: vi.fn(() => ["/logos/brand-a.png", "/logos/brand-b.png"]),
  logoLibraryPath: vi.fn(() => "/fake/logos"),
}));

describe("LogoPickerGrid", () => {
  it("renders one thumbnail per file returned by listLogoFiles", () => {
    render(<LogoPickerGrid onSelect={() => {}} />);
    expect(screen.getByTitle("brand-a.png")).toBeInTheDocument();
    expect(screen.getByTitle("brand-b.png")).toBeInTheDocument();
  });

  it("calls onSelect with the clicked file's absolute path", () => {
    const onSelect = vi.fn();
    render(<LogoPickerGrid onSelect={onSelect} />);
    fireEvent.click(screen.getByTitle("brand-a.png"));
    expect(onSelect).toHaveBeenCalledWith("/logos/brand-a.png");
  });

  it("marks the selected file with the selected class", () => {
    render(<LogoPickerGrid onSelect={() => {}} selectedPath="/logos/brand-b.png" />);
    expect(screen.getByTitle("brand-b.png").className).toContain("selected");
    expect(screen.getByTitle("brand-a.png").className).not.toContain("selected");
  });
});
