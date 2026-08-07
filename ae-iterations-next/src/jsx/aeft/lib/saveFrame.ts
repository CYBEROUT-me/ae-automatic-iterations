// lib/saveFrame.ts — saveFrameToPng that actually verifies it produced a
// file, extracted from render.ts so the position-picker preview gets the
// same guarantee the delivery renders do.
//
// Confirmed live: saveFrameToPng regularly returns without throwing well
// before the PNG lands on disk. A run that reported "no PNG after 3
// attempts (1.5s)" for three comps turned out to have two of those three
// appear later, so the write was real but slower than the check. Anything
// that consumes the file immediately after the call needs to wait for it.
//
// Deleting first matters for callers that reuse a fixed filename (the
// position preview does): without it, a stale file from a previous call
// satisfies the existence check instantly and the caller happily shows
// last time's frame as if it were current.

const MAX_ATTEMPTS = 10;
const WAIT_MS = 750;

export function saveFrameVerified(comp: CompItem, file: File): boolean {
  try {
    if (file.exists) file.remove();
  } catch (e) {}

  comp.saveFrameToPng(0, file);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // A FRESH File object per check: re-reading .exists on the same
    // instance can return stale cached state rather than what's actually
    // on disk right now.
    const check = new File(file.fsName);
    if (check.exists && check.length > 0) return true;
    $.sleep(WAIT_MS);
  }
  return false;
}
