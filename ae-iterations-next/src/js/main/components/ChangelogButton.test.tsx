import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangelogButton } from "./ChangelogButton";

describe("ChangelogButton", () => {
  it("hides the entry list until the info button is clicked", () => {
    render(<ChangelogButton />);
    expect(screen.queryByText("v0.4.0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("What's new"));
    expect(screen.getByText("v0.4.0")).toBeInTheDocument();
  });

  it("renders each entry's version, date, and changes from the real bundled data", () => {
    render(<ChangelogButton />);
    fireEvent.click(screen.getByTitle("What's new"));
    expect(screen.getByText("v0.4.0")).toBeInTheDocument();
    expect(screen.getByText("2026-07-14")).toBeInTheDocument();
    expect(screen.getByText(/Cross-platform font picker/)).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
  });

  it("toggles closed when the button is clicked again", () => {
    render(<ChangelogButton />);
    const btn = screen.getByTitle("What's new");
    fireEvent.click(btn);
    expect(screen.getByText("v0.4.0")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText("v0.4.0")).not.toBeInTheDocument();
  });
});
