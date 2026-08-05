import { useEffect, useState } from "react";
import { listLogoFiles, logoLibraryPath } from "../lib/logoLibrary";

export function LogoPickerGrid({
  onSelect,
  selectedPath,
}: {
  onSelect: (path: string) => void;
  selectedPath?: string;
}) {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    setFiles(listLogoFiles());
  }, []);

  if (files.length === 0) {
    return (
      <div className="logo-empty-state">
        No logos yet — drop image files into
        <br />
        <code>{logoLibraryPath()}</code>
        <br />
        (subfolders are fine — one per brand/client works great)
      </div>
    );
  }

  const libraryPath = logoLibraryPath();

  return (
    <div className="logo-picker-grid">
      {files.map((filePath) => {
        // Relative path from the library root (e.g. "CallMeChat/icon logo.png")
        // so files with the same name in different brand subfolders are
        // still distinguishable in the title tooltip.
        const relative = filePath.startsWith(libraryPath) ? filePath.slice(libraryPath.length + 1) : filePath;
        const name = filePath.split(/[\\/]/).pop() || filePath;
        return (
          <div
            key={filePath}
            className={"emoji-grid-item" + (filePath === selectedPath ? " selected" : "")}
            title={relative}
            onClick={() => onSelect(filePath)}
          >
            <img src={"file://" + filePath} alt={name} />
          </div>
        );
      })}
    </div>
  );
}
