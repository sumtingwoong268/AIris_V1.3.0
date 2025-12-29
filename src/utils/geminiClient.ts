// src/utils/geminiClient.ts
export async function generateReport(payload: { prompt?: string; userData?: unknown }) {
  const res = await fetch("/api/generate-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const raw = await res.text();
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    json = undefined;
  }

  if (!res.ok) {
    const message = json?.error ?? raw ?? res.statusText;
    const error: any = new Error(`generate-report failed: ${res.status} ${message}`);
    error.status = res.status;
    if (typeof json?.retryAfterSeconds === "number") {
      error.retryAfterSeconds = json.retryAfterSeconds;
    }
    throw error;
  }

  if (!json) {
    throw new Error("generate-report failed: empty response");
  }

  return json as { text: string; meta?: any };
}
