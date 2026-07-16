import entries from "../changelog.json";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

const changelogEntries = entries as ChangelogEntry[];

export function ChangelogList() {
  return (
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
  );
}
