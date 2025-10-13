// src/utils/openaiClient.ts
export async function generateReport(payload: { prompt: string; userData?: unknown }) {
  const res = await fetch("/api/generate-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`generate-report failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<{ text: string; meta?: any }>;
}
