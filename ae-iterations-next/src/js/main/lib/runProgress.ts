// Reads the one-line progress breadcrumb the host writes during a run
// (see jsx/aeft/lib/progress.ts). The path always comes from the host's
// varRunBegin response rather than being derived here: ExtendScript's
// Folder.temp and Node's os.tmpdir() do not reliably resolve to the same
// directory on macOS, so a locally-derived path would quietly read a file
// that never changes.

import * as fs from "fs";

export function readRunProgress(filePath: string): string {
  try {
    if (!filePath || !fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8").trim();
  } catch (e) {
    // Progress is cosmetic; a transient read failure (including the host
    // rewriting the file at the moment we read it) just means this poll
    // shows nothing new.
    return "";
  }
}
