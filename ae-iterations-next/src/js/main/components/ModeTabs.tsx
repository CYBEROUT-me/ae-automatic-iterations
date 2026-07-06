export function ModeTabs() {
  return (
    <div id="mode-tabs">
      <button className="tab-btn active">ITR</button>
      <button className="tab-btn" disabled title="VAR mode ships in a later phase">VAR</button>
    </div>
  );
}
