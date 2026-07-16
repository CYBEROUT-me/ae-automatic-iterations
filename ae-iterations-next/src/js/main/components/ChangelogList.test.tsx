import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChangelogList } from "./ChangelogList";

describe("ChangelogList", () => {
  it("renders each entry's version, date, and changes from the real bundled data", () => {
    render(<ChangelogList />);
    expect(screen.getByText("v0.4.0")).toBeInTheDocument();
    expect(screen.getByText("2026-07-14")).toBeInTheDocument();
    expect(screen.getByText(/Cross-platform font picker/)).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
  });
});
