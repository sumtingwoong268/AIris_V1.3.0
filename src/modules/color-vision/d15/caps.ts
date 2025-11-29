import type { Lab } from "@/lib/colourUtils";

export interface HueCap {
  capId: string;
  lab: Lab; // [L*, a*, b*]
  isFixed: boolean;
  panelType: "D15" | "LD15";
}

// Farnsworth D-15 (Illuminant C) approximate CIELAB values from published xyY coordinates.
// Pilot cap is fixed; remaining caps are movable. Neutral end anchor keeps two unmovable references.
export const D15_CAPS: HueCap[] = [
  { capId: "D15_PILOT", lab: [51.0, -8.7, -25.9], isFixed: true, panelType: "D15" },
  { capId: "D15_01", lab: [51.6, -9.6, -19.2], isFixed: false, panelType: "D15" },
  { capId: "D15_02", lab: [52.0, -11.2, -13.5], isFixed: false, panelType: "D15" },
  { capId: "D15_03", lab: [52.3, -12.1, -8.3], isFixed: false, panelType: "D15" },
  { capId: "D15_04", lab: [52.5, -13.3, -2.3], isFixed: false, panelType: "D15" },
  { capId: "D15_05", lab: [52.6, -14.5, 4.5], isFixed: false, panelType: "D15" },
  { capId: "D15_06", lab: [52.4, -16.5, 14.0], isFixed: false, panelType: "D15" },
  { capId: "D15_07", lab: [51.3, -15.9, 22.4], isFixed: false, panelType: "D15" },
  { capId: "D15_08", lab: [49.5, -11.7, 28.0], isFixed: false, panelType: "D15" },
  { capId: "D15_09", lab: [47.9, -5.7, 28.4], isFixed: false, panelType: "D15" },
  { capId: "D15_10", lab: [46.2, 3.1, 26.0], isFixed: false, panelType: "D15" },
  { capId: "D15_11", lab: [45.7, 9.2, 20.8], isFixed: false, panelType: "D15" },
  { capId: "D15_12", lab: [46.0, 14.0, 14.8], isFixed: false, panelType: "D15" },
  { capId: "D15_13", lab: [47.0, 16.8, 5.6], isFixed: false, panelType: "D15" },
  { capId: "D15_14", lab: [48.0, 15.5, -4.1], isFixed: false, panelType: "D15" },
  { capId: "D15_15", lab: [49.5, 11.0, -13.3], isFixed: false, panelType: "D15" },
  { capId: "D15_ANCHOR_END", lab: [49.5, 11.0, -13.3], isFixed: true, panelType: "D15" },
];

const RAW_LD15_CAPS: HueCap[] = [
  { capId: "LD15_PILOT", lab: [78.8, -3.5, -10.4], isFixed: true, panelType: "LD15" },
  { capId: "LD15_01", lab: [79.0, -3.8, -7.7], isFixed: false, panelType: "LD15" },
  { capId: "LD15_02", lab: [79.2, -4.5, -5.4], isFixed: false, panelType: "LD15" },
  { capId: "LD15_03", lab: [79.3, -4.8, -3.3], isFixed: false, panelType: "LD15" },
  { capId: "LD15_04", lab: [79.4, -5.3, -0.9], isFixed: false, panelType: "LD15" },
  { capId: "LD15_05", lab: [79.4, -5.8, 1.8], isFixed: false, panelType: "LD15" },
  { capId: "LD15_06", lab: [79.3, -6.6, 5.6], isFixed: false, panelType: "LD15" },
  { capId: "LD15_07", lab: [78.9, -6.4, 9.0], isFixed: false, panelType: "LD15" },
  { capId: "LD15_08", lab: [78.2, -4.7, 11.2], isFixed: false, panelType: "LD15" },
  { capId: "LD15_09", lab: [77.5, -2.3, 11.4], isFixed: false, panelType: "LD15" },
  { capId: "LD15_10", lab: [76.9, 1.2, 10.4], isFixed: false, panelType: "LD15" },
  { capId: "LD15_11", lab: [76.7, 3.7, 8.3], isFixed: false, panelType: "LD15" },
  { capId: "LD15_12", lab: [76.8, 5.6, 5.9], isFixed: false, panelType: "LD15" },
  { capId: "LD15_13", lab: [77.1, 6.7, 2.2], isFixed: false, panelType: "LD15" },
  { capId: "LD15_14", lab: [77.5, 6.2, -1.6], isFixed: false, panelType: "LD15" },
  { capId: "LD15_15", lab: [78.2, 4.4, -5.3], isFixed: true, panelType: "LD15" },
];

// Slightly increase chroma for better visual separability while keeping lightness and hue relationships intact.
const SATURATION_FACTOR = 1.08; // gentle bump

export const LD15_CAPS: HueCap[] = RAW_LD15_CAPS.map((cap) => {
  const [L, a, b] = cap.lab;
  const boosted: Lab = [L, Number((a * SATURATION_FACTOR).toFixed(2)), Number((b * SATURATION_FACTOR).toFixed(2))];
  return { ...cap, lab: boosted };
});
