import "./main.scss";
import { LayerInfoPanel } from "./components/LayerInfoPanel";
import { evalTS } from "../lib/utils/bolt";

// TEMPORARY — manual verification only for Task 12. Superseded by the real
// run-iterations engine in Task 16; remove this button and the debugRender call.
const debugRender = () => {
  evalTS("debugRender", "/tmp/ae-iter-render-test")
    .then((res) => alert("rendered: " + res.rendered))
    .catch((err) => alert("debugRender failed: " + String(err)));
};

// TEMPORARY — manual verification only for Task 14. Superseded by the real
// run-iterations engine in Task 16; remove this button and the debugCollect call.
const debugCollect = () => {
  evalTS("debugCollect", "/tmp/ae-iter-collect-test")
    .then((res) => alert("collected: " + res.collected))
    .catch((err) => alert("debugCollect failed: " + String(err)));
};

// TEMPORARY — manual verification only for Task 15. Superseded by the real
// run-iterations engine in Task 16; remove this button and the debugCopyProject call.
const debugCopyProject = () => {
  evalTS("debugCopyProject")
    .then((res) => alert("copied: " + res.newFileName + "  oldId=" + res.oldId + " newId=" + res.newId))
    .catch((err) => alert("debugCopyProject failed: " + String(err)));
};

// TEMPORARY — manual verification only for Task 15. Superseded by the real
// run-iterations engine in Task 16; remove this button and the debugRenameComps call.
const debugRenameComps = () => {
  const oldId = prompt("Old ID (e.g. 10794):", "") || "";
  const newId = prompt("New ID (e.g. 10795):", "") || "";
  evalTS("debugRenameComps", oldId, newId)
    .then((res) => alert("renamed: " + res.renamed))
    .catch((err) => alert("debugRenameComps failed: " + String(err)));
};

export const App = () => {
  return (
    <>
      <LayerInfoPanel />
      <button onClick={debugRender}>DEBUG: Render ITR Comps</button>
      <button onClick={debugCollect}>DEBUG: Collect Project</button>
      <button onClick={debugCopyProject}>DEBUG: Copy Project</button>
      <button onClick={debugRenameComps}>DEBUG: Rename Comps</button>
    </>
  );
};
