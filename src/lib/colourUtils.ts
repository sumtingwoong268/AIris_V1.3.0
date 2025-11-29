export type Lab = [number, number, number]; // [L*, a*, b*]
export type Rgb = [number, number, number]; // [R, G, B] 0–255

// D65 white reference
const D65: [number, number, number] = [95.047, 100.0, 108.883];

// sRGB gamma helpers
function srgbChannelToLinear(c: number): number {
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgbChannel(c: number): number {
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// sRGB → XYZ
export function srgbToXyz(rgb: Rgb): [number, number, number] {
  let [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  r = srgbChannelToLinear(r);
  g = srgbChannelToLinear(g);
  b = srgbChannelToLinear(b);
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;
  return [x * 100, y * 100, z * 100];
}

// XYZ → sRGB
export function xyzToSrgb(xyz: [number, number, number]): Rgb {
  let [x, y, z] = xyz.map((v) => v / 100) as [number, number, number];
  let r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  let g = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  let b = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return [
    Math.round(clamp(linearToSrgbChannel(r)) * 255),
    Math.round(clamp(linearToSrgbChannel(g)) * 255),
    Math.round(clamp(linearToSrgbChannel(b)) * 255),
  ];
}

// XYZ ↔ Lab
function fLab(t: number): number {
  const d = 6 / 29;
  return t > d ** 3 ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
}
function fInvLab(t: number): number {
  const d = 6 / 29;
  return t > d ? t ** 3 : 3 * d * d * (t - 4 / 29);
}

export function xyzToLab(xyz: [number, number, number]): Lab {
  const [Xn, Yn, Zn] = D65;
  const [X, Y, Z] = xyz;
  const x = fLab(X / Xn);
  const y = fLab(Y / Yn);
  const z = fLab(Z / Zn);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function labToXyz(lab: Lab): [number, number, number] {
  const [Xn, Yn, Zn] = D65;
  const [L, a, b] = lab;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  return [Xn * fInvLab(fx), Yn * fInvLab(fy), Zn * fInvLab(fz)];
}

// sRGB ↔ Lab convenience
export const srgbToLab = (rgb: Rgb): Lab => xyzToLab(srgbToXyz(rgb));
export const labToSrgb = (lab: Lab): Rgb => xyzToSrgb(labToXyz(lab));

// ΔE*76
export function deltaE76(l1: Lab, l2: Lab): number {
  const [L1, a1, b1] = l1;
  const [L2, a2, b2] = l2;
  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

// Confusion axis angle via PCA, deg 0–180
export function confusionAxisAngle(labs: Lab[]): number {
  if (labs.length < 2) return 0;
  let ma = 0;
  let mb = 0;
  labs.forEach(([_, a, b]) => {
    ma += a;
    mb += b;
  });
  ma /= labs.length;
  mb /= labs.length;
  let Sxx = 0;
  let Syy = 0;
  let Sxy = 0;
  labs.forEach(([_, a, b]) => {
    const da = a - ma;
    const db = b - mb;
    Sxx += da * da;
    Syy += db * db;
    Sxy += da * db;
  });
  Sxx /= labs.length;
  Syy /= labs.length;
  Sxy /= labs.length;
  const theta = 0.5 * Math.atan2(2 * Sxy, Sxx - Syy);
  let deg = (theta * 180) / Math.PI;
  if (deg < 0) deg += 180;
  if (deg >= 180) deg -= 180;
  return deg;
}
