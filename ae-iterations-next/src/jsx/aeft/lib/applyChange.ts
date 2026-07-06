// Ported from extension/jsx/lib/apply-change.jsx — color, font, and text
// content application for shape and text layers. Internal library functions
// (not host-command entry points), so they keep the original's
// return-boolean convention rather than throwing on failure.

export function applyShapeColor(layer: any, fillPath: string, colorRGB: [number, number, number]): boolean {
  const parts = fillPath.split("/");
  let current = layer;
  try {
    for (let i = 0; i < parts.length; i++) {
      current = current.property(parts[i]);
      if (!current) throw new Error("null at step " + i + " («" + parts[i] + "»)");
    }
    current.property("Color").setValue(colorRGB);
    return true;
  } catch (e) {
    return false;
  }
}

export function applyShapeStrokeColor(layer: any, strokePath: string, colorRGB: [number, number, number]): boolean {
  const parts = strokePath.split("/");
  let current = layer;
  try {
    for (let i = 0; i < parts.length; i++) {
      current = current.property(parts[i]);
      if (!current) throw new Error("null at «" + parts[i] + "»");
    }
    current.property("Color").setValue(colorRGB);
    return true;
  } catch (e) {
    return false;
  }
}

// Primary: TextStyle API (AE 2022+).
//   textDoc.createStyle().setFillColor(color).applyToAllKeyframes()
//   — works regardless of whether "Source Text" has keyframes, and never
//     triggers the "must select keyframes to export" dialog.
// Fallback: modify each keyframe directly, or setValue for static text.
export function applyTextColor(layer: TextLayer, colorRGB: [number, number, number]): boolean {
  const textProp = layer.property("Source Text") as any;
  try {
    const textDoc = textProp.value;
    textDoc.createStyle().setFillColor(colorRGB).applyToAllKeyframes();
    return true;
  } catch (e) {}

  try {
    if (textProp.numKeys > 0) {
      for (let k = 1; k <= textProp.numKeys; k++) {
        const kDoc = textProp.keyValue(k);
        kDoc.applyFill = true;
        kDoc.fillColor = colorRGB;
        textProp.setValueAtTime(textProp.keyTime(k), kDoc);
      }
    } else {
      const textDoc2 = textProp.value;
      textDoc2.applyFill = true;
      textDoc2.fillColor = colorRGB;
      textProp.setValue(textDoc2);
    }
    return true;
  } catch (e2) {
    return false;
  }
}

export function applyTextContent(layer: TextLayer, text: string): boolean {
  // Convert \n (typed literally in the panel) to AE's line-break character (\r)
  text = text.replace(/\\n/g, "\r");
  const textProp = layer.property("Source Text") as any;
  try {
    if (textProp.numKeys > 0) {
      for (let k = 1; k <= textProp.numKeys; k++) {
        const kDoc = textProp.keyValue(k);
        kDoc.text = text;
        textProp.setValueAtTime(textProp.keyTime(k), kDoc);
      }
    } else {
      const textDoc = textProp.value;
      textDoc.text = text;
      textProp.setValue(textDoc);
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Same pattern for font — setFont(postScriptName) on the TextStyle chain.
export function applyTextFont(layer: TextLayer, fontName: string): boolean {
  const textProp = layer.property("Source Text") as any;
  try {
    const textDoc = textProp.value;
    textDoc.createStyle().setFont(fontName).applyToAllKeyframes();
    return true;
  } catch (e) {}

  try {
    if (textProp.numKeys > 0) {
      for (let k = 1; k <= textProp.numKeys; k++) {
        const kDoc = textProp.keyValue(k);
        kDoc.font = fontName;
        textProp.setValueAtTime(textProp.keyTime(k), kDoc);
      }
    } else {
      const textDoc2 = textProp.value;
      textDoc2.font = fontName;
      textProp.setValue(textDoc2);
    }
    return true;
  } catch (e2) {
    return false;
  }
}
