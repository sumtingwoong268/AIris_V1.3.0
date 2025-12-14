const ALLOWED_LANGUAGES = new Set(["en", "hi", "bn", "pa", "ta", "kn", "ko", "ur", "ja"]);

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const getHeader = (headers: RequestLike["headers"], name: string) => {
  if (!headers) return undefined;
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const parseJsonBody = (body: unknown) => {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (body && typeof body === "object") return body as Record<string, unknown>;
  return null;
};

const cleanEnv = (value: string | undefined) => (typeof value === "string" && value.trim() ? value.trim() : "");

const TRANSLATOR_KEY =
  cleanEnv(process.env.AZURE_TRANSLATOR_KEY) || cleanEnv(process.env.VITE_AZURE_TRANSLATOR_KEY);
const TRANSLATOR_REGION =
  cleanEnv(process.env.AZURE_TRANSLATOR_REGION) || cleanEnv(process.env.VITE_AZURE_TRANSLATOR_REGION);
const TRANSLATOR_ENDPOINT =
  cleanEnv(process.env.AZURE_TRANSLATOR_ENDPOINT) ||
  cleanEnv(process.env.VITE_AZURE_TRANSLATOR_ENDPOINT) ||
  "https://api.cognitive.microsofttranslator.com";

const sanitizeTexts = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const texts: string[] = [];
  for (const value of input) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (trimmed.length > 500) continue; // avoid oversize payloads
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    texts.push(trimmed);
    if (texts.length >= 200) break; // cap to keep payload reasonable
  }
  return texts;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  if (!TRANSLATOR_KEY || !TRANSLATOR_REGION) {
    res.status(500).json({
      error:
        "Azure Translator credentials are missing. Set AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION, and AZURE_TRANSLATOR_ENDPOINT.",
    });
    return;
  }

  const contentType = getHeader(req.headers, "content-type") ?? "";
  if (!contentType.includes("application/json")) {
    res.status(400).json({ error: "Content-Type must be application/json" });
    return;
  }

  const parsed = parseJsonBody(req.body);
  const to = typeof parsed?.to === "string" ? parsed.to.trim() : "";
  const from = typeof parsed?.from === "string" ? parsed.from.trim() : "";
  const texts = sanitizeTexts(parsed?.texts);

  if (!to || !ALLOWED_LANGUAGES.has(to)) {
    res.status(400).json({ error: "Unsupported or missing target language" });
    return;
  }

  if (texts.length === 0) {
    res.status(400).json({ error: "No texts provided for translation" });
    return;
  }

  const endpoint = TRANSLATOR_ENDPOINT.replace(/\/$/, "");
  const searchParams = new URLSearchParams({ "api-version": "3.0", to });
  if (from && ALLOWED_LANGUAGES.has(from)) {
    searchParams.append("from", from);
  }
  const url = `${endpoint}/translate?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": TRANSLATOR_KEY,
        "Ocp-Apim-Subscription-Region": TRANSLATOR_REGION,
      },
      body: JSON.stringify(texts.map((text) => ({ Text: text }))),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({ error: text || "Translation request failed" });
      return;
    }

    const data = (await response.json()) as Array<{
      translations?: Array<{ text: string }>;
    }>;

    const translations: Record<string, string> = {};
    data.forEach((item, index) => {
      const translated = item?.translations?.[0]?.text;
      translations[texts[index]] = translated ?? texts[index];
    });

    res.status(200).json({ translations, target: to });
  } catch (error: any) {
    console.error("Azure translation error:", error);
    res.status(500).json({ error: "Failed to translate text" });
  }
}
