// Auto-restores the last session's panel setup on mount, then keeps it
// saved as the user edits. Mounted once, from LayerInfoPanel.
//
// Two ordering rules matter here:
//
// 1. Nothing is saved until the initial restore has run. Zustand fires its
//    subscriber on the very first store write, so without the `restored`
//    guard the panel's own default state would be written over a real
//    saved session before the user touched anything.
//
// 2. The debounce callback re-reads the file instead of closing over the
//    copy loaded at mount, so an autosave triggered by an ordinary edit
//    can't clobber a job preset saved moments earlier in the same session.

import { useEffect, useRef } from "react";
import { useAppStore } from "./store";
import { loadPanelState, savePanelState } from "../lib/panelState";
import { captureSetup, applySetup } from "./panelSetup";

const SAVE_DEBOUNCE_MS = 400;

export function usePanelPersistence(): void {
  const restored = useRef(false);

  useEffect(() => {
    try {
      const patch = applySetup(loadPanelState().lastSession);
      if (Object.keys(patch).length) useAppStore.setState(patch);
    } catch (e) {
      // A failed restore must never block the panel from mounting — the
      // user simply starts from defaults, exactly as before this existed.
    }
    restored.current = true;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useAppStore.subscribe(() => {
      if (!restored.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const onDisk = loadPanelState();
        savePanelState({ ...onDisk, lastSession: captureSetup(useAppStore.getState()) });
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
