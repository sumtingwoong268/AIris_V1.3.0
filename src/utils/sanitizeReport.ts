// src/utils/sanitizeReport.ts
export function stripHtml(s: string) {
  // remove any tags; keep text
  return s.replace(/<[^>]+>/g, "");
}

export function cleanBlocks(blocks: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of blocks ?? []) {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) continue;
    const noFences = trimmed.replace(/^```(?:json|md)?\s*|\s*```$/g, "");
    const noHtml = stripHtml(noFences).replace(/\s+\n/g, "\n").trim();
    if (!noHtml) continue;
    if (seen.has(noHtml)) continue;
    seen.add(noHtml);
    out.push(noHtml);
  }
  return out;
}

export function sanitizeReport(report: any) {
  const safe = { ...report };
  // visual theme defaults
  safe.visual_theme = {
    accentColor: report?.visual_theme?.accentColor || "#6B8AFB",
    trafficLight: report?.visual_theme?.trafficLight || "green",
    urgency: report?.visual_theme?.urgency || "no_action",
    summary: stripHtml((report?.visual_theme?.summary ?? "").trim()),
  };
  safe.sections = (report?.sections ?? []).map((sec: any) => ({
    title: stripHtml((sec?.title ?? "").trim()) || "Untitled",
    blocks: cleanBlocks(sec?.blocks ?? []),
  })).filter((s: any) => s.blocks.length > 0);
  return safe;
}
