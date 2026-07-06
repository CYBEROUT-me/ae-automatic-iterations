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

export const App = () => {
  return (
    <>
      <LayerInfoPanel />
      <button onClick={debugRender}>DEBUG: Render ITR Comps</button>
      <button onClick={debugCollect}>DEBUG: Collect Project</button>
    </>
  );
};
