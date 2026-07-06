// Ported from extension/jsx/lib/clean.jsx — project panel organisation
// ("Finish Him Clean Project"). Reorganises items into canonical folders
// (Stuff / 01_Video / 02_Images / 03_Pre-Comp / 04_Sound / 05_Other / Solids /
// Texts / MOGRT Stuff / Missing Files) and removes unused items across up to
// 10 passes (folder moves can surface newly-unused items, so a single pass
// is not always enough — matches the original's pass loop in cleanProject).
//
// `app.project.item(i)` is typed as `_ItemClasses = CompItem | FootageItem |
// FolderItem` (types-for-adobe/AfterEffects/22.0), but this code duck-types
// across that union using properties that only exist on some members
// (`.file`, `.hasVideo`, `.hasAudio`, `.duration`, `.footageMissing`,
// `.usedIn`, `.numLayers`, `.layer()`) gated by runtime `typeName`/`instanceof`
// checks, exactly like the original .jsx. Real ambient types are used for
// return types and constructible classes (FolderItem, ShapeLayer, TextLayer,
// CompItem); `any` is used for the generic per-item loop variables, matching
// the original's untyped duck-typing.
//
// Intentional deviation from the original (per plan Task 13): the original
// _clSinglePass unused-item check is `if (ri.usedIn == 0 && !ri.selected)`,
// comparing an array (`usedIn: CompItem[]`) to the number 0 with loose
// equality — always `false` in JavaScript, so that half of the condition
// never actually filtered anything in the shipping extension. This port
// uses `ri.usedIn.length === 0`, which is what the check was clearly meant
// to do. This is a deliberate, reviewed behavior fix, not a bug to avoid.

const LANG_FOLDERS = ["AR", "CH", "DE", "EN", "ES", "FR", "HI", "IT", "JP", "KR", "PL", "PT", "RU", "TU"];

function ensureMainStuffFolder(): FolderItem {
  const root = app.project.rootFolder;
  for (let i = 1; i <= app.project.numItems; i++) {
    const it = app.project.item(i);
    if (it instanceof FolderItem && it.name === "Stuff") {
      if (it.parentFolder !== root) {
        try {
          it.parentFolder = root;
        } catch (e) {}
      }
      return it;
    }
  }
  const f = app.project.items.addFolder("Stuff");
  try {
    f.parentFolder = root;
  } catch (e) {}
  return f;
}

function ensureSub(name: string, parent: FolderItem): FolderItem {
  for (let i = 1; i <= app.project.numItems; i++) {
    const it = app.project.item(i);
    if (it instanceof FolderItem && it.name === name && it.parentFolder === parent) return it;
  }
  const f = app.project.items.addFolder(name);
  try {
    f.parentFolder = parent;
  } catch (e) {}
  return f;
}

function inMediaReplacement(item: any, mrf: FolderItem | null): boolean {
  if (!mrf) return false;
  let p = item.parentFolder;
  while (p) {
    if (p === mrf) return true;
    p = p.parentFolder;
  }
  return false;
}

function layerTypeOf(obj: any): string | null {
  if (!obj.blendingMode && !obj.isTrackMatte && !obj.source) return "Camera/Light";
  if (obj instanceof ShapeLayer) return "Shape";
  if (obj instanceof TextLayer) return "Text";
  if (!obj.source.file && obj.source.duration == 0) return "Solid";
  if (obj.source instanceof CompItem) return "Composition";
  if (obj.source.hasVideo === false && obj.source.hasAudio === true) return "Audio";
  if (obj.source.hasVideo === true && obj.source.hasAudio === true && obj.duration !== 0) return "Video";
  if (obj.source.hasVideo === true && obj.source.hasAudio === false && obj.source.duration === 0) return "Picture";
  if (obj.source.hasVideo === true && obj.duration !== 0 && obj.source.hasAudio === false) return "Video";
  return null;
}

function inLangFolder(parentName: string): boolean {
  return LANG_FOLDERS.indexOf(parentName) !== -1;
}

function singlePass(protectedNames?: string[]): { removed: number } {
  const main = ensureMainStuffFolder();
  const vd = ensureSub("01_Video", main);
  const img = ensureSub("02_Images", main);
  const pcm = ensureSub("03_Pre-Comp", main);
  const snd = ensureSub("04_Sound", main);
  const oth = ensureSub("05_Other", main);
  const sld = ensureSub("Solids", oth);
  const txt = ensureSub("Texts", main);
  ensureSub("MOGRT Stuff", main);
  const miss = ensureSub("Missing Files", main);

  let mrf: FolderItem | null = null;
  for (let i = 1; i <= app.project.numItems; i++) {
    const it = app.project.item(i);
    if (it instanceof FolderItem && it.name === "Media Replacement Comps") {
      mrf = it;
      try {
        it.parentFolder = main;
      } catch (e) {}
    }
  }

  for (let s = app.project.numItems; s >= 1; s--) {
    const si = app.project.item(s) as any;
    if (inMediaReplacement(si, mrf)) continue;
    const pn = (si.parentFolder && si.parentFolder.name) || "";
    const sub = !inLangFolder(pn);
    const msf = pn.slice(0, 6) !== "Texts_";
    try {
      if (si.typeName === "Footage" && !si.file) si.parentFolder = sld;

      if (!si.selected && si.typeName === "Composition" && sub && msf) {
        let prot = false;
        if (protectedNames) {
          for (let pp = 0; pp < protectedNames.length; pp++) {
            if (si.name === protectedNames[pp]) {
              prot = true;
              break;
            }
          }
        }
        if (!prot) {
          let hasText = false,
            hasOther = false;
          for (let l = si.numLayers; l >= 1; l--) {
            try {
              const t = layerTypeOf(si.layer(l));
              if (t === "Text") hasText = true;
              else hasOther = true;
            } catch (eL) {
              hasOther = true;
            }
          }
          si.parentFolder = hasText && !hasOther ? txt : pcm;
        }
      }

      if (si.typeName === "Folder" && si.name.slice(0, 6) === "Texts_") si.parentFolder = txt;
      if (si.file && si.hasVideo && si.hasAudio && si.duration !== 0) si.parentFolder = vd;
      if (si.file && si.duration === 0) si.parentFolder = img;
      if (si.file && si.duration !== 0 && !si.hasAudio) si.parentFolder = vd;
      if (si.file && !si.hasVideo && si.hasAudio) si.parentFolder = snd;
      if (si.footageMissing) si.parentFolder = miss;
    } catch (e) {}
  }

  let removed = 0;
  for (let s2 = app.project.numItems; s2 >= 1; s2--) {
    const ri = app.project.item(s2) as any;
    if (inMediaReplacement(ri, mrf)) continue;
    if (protectedNames) {
      let prot = false;
      for (let pi = 0; pi < protectedNames.length; pi++) {
        if (ri.name === protectedNames[pi]) {
          prot = true;
          break;
        }
      }
      if (prot) continue;
    }
    try {
      if (ri.usedIn.length === 0 && !ri.selected) {
        ri.remove();
        removed++;
      }
    } catch (e) {}
  }

  try {
    app.project.removeUnusedFootage();
  } catch (e) {}
  try {
    app.project.consolidateFootage();
  } catch (e) {}
  return { removed };
}

export function cleanProject(protectedNames?: string[]): { removed: number } {
  app.beginUndoGroup("AE Iterations – Clean Project");
  let total = 0;
  try {
    for (let pass = 0; pass < 10; pass++) total += singlePass(protectedNames).removed;
  } finally {
    try {
      app.endUndoGroup();
    } catch (e) {}
  }
  return { removed: total };
}
