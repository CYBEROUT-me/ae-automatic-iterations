import "./main.scss";
import { LayerInfoPanel } from "./components/LayerInfoPanel";
import { evalTS } from "../lib/utils/bolt";

// TEMPORARY — manual verification only for Task 10. Superseded by the real
// preview flow in Task 11; remove this button and the debugApplyRed call.
const debugApplyRed = () => {
  evalTS("debugApplyRed")
    .then((res) => alert("applied: " + res.applied))
    .catch((err) => alert("debugApplyRed failed: " + String(err)));
};

export const App = () => {
  return (
    <>
      <LayerInfoPanel />
      <button onClick={debugApplyRed}>DEBUG: Apply Red Fill</button>
    </>
  );
};
