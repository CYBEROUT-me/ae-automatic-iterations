import { useAppStore } from "../state/store";

export function ModeTabs() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);

  return (
    <div id="mode-tabs">
      <button className={"tab-btn" + (mode === "itr" ? " active" : "")} onClick={() => setMode("itr")}>
        ITR
      </button>
      <button className={"tab-btn" + (mode === "var" ? " active" : "")} onClick={() => setMode("var")}>
        VAR
      </button>
    </div>
  );
}
