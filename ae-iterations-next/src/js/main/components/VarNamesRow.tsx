import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";

export function VarNamesRow() {
  const { count, varNames, setVarName } = useAppStore(
    useShallow((s) => ({ count: s.count, varNames: s.varNames, setVarName: s.setVarName }))
  );

  return (
    <div id="var-names-row">
      {Array.from({ length: count }, (_, i) => (
        <input
          key={i}
          type="text"
          placeholder={`Name ${i + 1}`}
          value={varNames[i] ?? ""}
          onChange={(e) => setVarName(i, e.target.value)}
        />
      ))}
    </div>
  );
}
