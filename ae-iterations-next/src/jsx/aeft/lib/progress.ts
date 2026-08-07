// lib/progress.ts — one-line progress breadcrumbs written to a temp file
// during a run, so the panel can show what a long-blocking step is doing.
//
// Why a file rather than a return value: while ExtendScript is running a
// step, AE's main thread is blocked and nothing can be returned until that
// step finishes. The CEP panel, though, is a separate Chromium process
// with its own event loop, so it can poll this file and update the UI
// mid-step. That's what makes "Variant 3/5 — collecting…" possible at all.
//
// The path is handed back to the panel by beginProgress() rather than
// derived independently on both sides: ExtendScript's Folder.temp and
// Node's os.tmpdir() do NOT reliably resolve to the same directory on
// macOS (Folder.temp can land in .../T/TemporaryItems), so any guess made
// panel-side would silently read a file that never updates.

let progressFile: File | null = null;

export function beginProgress(): string {
  const f = new File(Folder.temp.fsName + "/aeiter-progress.txt");
  progressFile = f;
  reportProgress("Starting…");
  return f.fsName;
}

// Overwrites rather than appends: the panel only ever wants the current
// step, and a single short line keeps the read cheap at poll frequency.
export function reportProgress(message: string): void {
  if (!progressFile) return;
  try {
    progressFile.encoding = "UTF-8";
    progressFile.open("w");
    progressFile.write(message);
    progressFile.close();
  } catch (e) {
    // Progress reporting is strictly cosmetic -- it must never be able to
    // take down a run that is otherwise working.
  }
}

export function endProgress(): void {
  if (!progressFile) return;
  try {
    progressFile.remove();
  } catch (e) {}
  progressFile = null;
}
