import { useState } from "react";
import entries from "../changelog.json";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

const changelogEntries = entries as ChangelogEntry[];

export function ChangelogButton() {
  const [open, setOpen] = useState(false);

  return (
    <div id="changelog-section">
      <button id="btn-changelog" className={open ? "open" : ""} title="What's new" onClick={() => setOpen(!open)}>
        ℹ
      </button>
      {open && (
        <div id="changelog-list">
          {changelogEntries.map((entry) => (
            <div key={entry.version} className="cl-entry">
              <div className="cl-header">
                <span className="cl-version">v{entry.version}</span>
                <span className="cl-date">{entry.date}</span>
              </div>
              <ul className="cl-changes">
                {entry.changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
