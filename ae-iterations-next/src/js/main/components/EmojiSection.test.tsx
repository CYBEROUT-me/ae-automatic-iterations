import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiSection } from "./EmojiSection";
import { useAppStore } from "../state/store";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn((command: string) => {
    if (command === "listEmojiFiles") {
      return Promise.resolve({ files: [{ path: "/emojis/fire.gif", name: "fire.gif" }] });
    }
    if (command === "previewEmoji") {
      return Promise.resolve({ compName: "Comp A" });
    }
    return Promise.reject(new Error("unexpected command: " + command));
  }),
}));

describe("EmojiSection", () => {
  beforeEach(() => {
    useAppStore.setState({
      count: 3, emojiEnabled: false, emojiPaths: [], emojiX: 540, emojiY: 1347, emojiSize: 100, emojiLayerIndex: 1,
    });
  });

  it("hides the config until enabled is checked", () => {
    render(<EmojiSection />);
    expect(screen.queryByText("Preview Emoji")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Add emoji overlay"));
    expect(screen.getByText("Preview Emoji")).toBeInTheDocument();
  });

  it("opens the picker grid on thumbnail click and assigns the selected emoji to that row", async () => {
    useAppStore.setState({ emojiEnabled: true });
    render(<EmojiSection />);
    fireEvent.click(screen.getAllByText("+")[0]); // first row's empty thumbnail
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByTitle("fire.gif"));
    expect(useAppStore.getState().emojiPaths[0]).toBe("/emojis/fire.gif");
    expect(screen.getByText("fire.gif")).toBeInTheDocument();
  });

  it("previews using the first row with a path set", async () => {
    useAppStore.setState({ emojiEnabled: true, emojiPaths: [null, "/emojis/heart.gif"] });
    render(<EmojiSection />);
    fireEvent.click(screen.getByText("Preview Emoji"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText(/Previewed in Comp A/)).toBeInTheDocument();
  });
});
