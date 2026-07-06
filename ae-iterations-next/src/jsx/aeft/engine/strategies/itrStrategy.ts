// ITR strategy — advances to the next iteration by copying the project file
// (incrementing its ID segment), renaming comps to match, and computing the
// next comp name. Mirrors extension/jsx/host.jsx's runIterationsJSON
// end-of-loop block (copyProject + app.open + renameComps + comp-name bump).

import { copyProject, renameComps } from "../../lib/project";
import { incrementProjectId } from "../../lib/naming";
import type { IterationStrategy, TargetState } from "../runIterationBatch";

export const ITR_STRATEGY: IterationStrategy = {
  nextTarget(current: TargetState): TargetState {
    const copied = copyProject(current.file);
    renameComps(copied.oldId, copied.newId);
    const newCompName = incrementProjectId(current.compName);
    return { file: copied.file, compName: newCompName };
  },
  outputFolderName(current: TargetState): string {
    return current.file.name.replace(/\.[^.]+$/, "");
  },
};
