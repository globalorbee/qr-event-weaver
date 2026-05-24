// Smart contrast checker. Pure function — safe on server and client.
// Computes relative luminance of a hex color and returns whether a dark or
// light foreground is more readable on top of it.

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// WCAG relative luminance in 0..1
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

export function contrastRatio(hexA: string, hexB: string): number {
  const la = luminance(hexA);
  const lb = luminance(hexB);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Pick #000 or #fff foreground for best readability over `bg`.
export function bestForeground(bg: string): "#000000" | "#ffffff" {
  return luminance(bg) > 0.5 ? "#000000" : "#ffffff";
}

// Returns true when scanner readability is likely to suffer.
// QR contrast under 3 (between fg/bg) is risky; saturated mid-tones also fail.
export function isScannerRisky(brand: string): boolean {
  const fg = bestForeground(brand);
  const ratio = contrastRatio(brand, fg);
  return ratio < 4.5;
}