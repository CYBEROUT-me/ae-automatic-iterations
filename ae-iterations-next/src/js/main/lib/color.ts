export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

export function rgbToHex(arr: [number, number, number]): string {
  const h = (v: number): string => {
    const s = Math.round(v * 255).toString(16);
    return s.length === 1 ? "0" + s : s;
  };
  return "#" + h(arr[0]) + h(arr[1]) + h(arr[2]);
}

export function normaliseHex(raw: string): string | null {
  let s = raw.trim();
  if (s[0] !== "#") s = "#" + s;
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : null;
}
