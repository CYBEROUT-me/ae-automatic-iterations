import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiPickerGrid } from "./EmojiPickerGrid";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() =>
    Promise.resolve({
      files: [
        { path: "/emojis/fire.gif", name: "fire.gif" },
        { path: "/emojis/heart.gif", name: "heart.gif" },
      ],
    })
  ),
}));

describe("EmojiPickerGrid", () => {
  it("renders one thumbnail per returned file", async () => {
    render(<EmojiPickerGrid onSelect={() => {}} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTitle("fire.gif")).toBeInTheDocument();
    expect(screen.getByTitle("heart.gif")).toBeInTheDocument();
  });

  it("calls onSelect with the clicked file's path and name", async () => {
    const onSelect = vi.fn();
    render(<EmojiPickerGrid onSelect={onSelect} />);
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByTitle("fire.gif"));
    expect(onSelect).toHaveBeenCalledWith("/emojis/fire.gif", "fire.gif");
  });

  it("highlights the item matching selectedPath, not the others", async () => {
    render(<EmojiPickerGrid onSelect={() => {}} selectedPath="/emojis/heart.gif" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTitle("heart.gif").className).toContain("selected");
    expect(screen.getByTitle("fire.gif").className).not.toContain("selected");
  });

  it("highlights nothing when selectedPath is not passed", async () => {
    render(<EmojiPickerGrid onSelect={() => {}} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTitle("fire.gif").className).not.toContain("selected");
    expect(screen.getByTitle("heart.gif").className).not.toContain("selected");
  });
});
