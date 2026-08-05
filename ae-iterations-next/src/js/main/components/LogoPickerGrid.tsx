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
    return <div className="emoji-empty">No logos yet — drop image files into {logoLibraryPath()}</div>;
  }

  return (
    <div className="logo-picker-grid">
      {files.map((filePath) => {
        const name = filePath.split(/[\\/]/).pop() || filePath;
        return (
          <div
            key={filePath}
            className={"emoji-grid-item" + (filePath === selectedPath ? " selected" : "")}
            title={name}
            onClick={() => onSelect(filePath)}
          >
            <img src={"file://" + filePath} alt={name} />
          </div>
        );
      })}
    </div>
  );
}
