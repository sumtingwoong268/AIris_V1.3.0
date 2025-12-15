const ALLOWED_LANGUAGES = new Set(["en", "hi", "bn", "pa", "ta", "ko", "ur", "ja"]);

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

const DEEPL_KEY = cleanEnv(process.env.DEEPL_API_KEY) || cleanEnv(process.env.VITE_DEEPL_API_KEY);
const DEEPL_ENDPOINT =
  cleanEnv(process.env.DEEPL_API_ENDPOINT) ||
  cleanEnv(process.env.VITE_DEEPL_API_ENDPOINT) ||
  "https://api-free.deepl.com/v2/translate";

type LanguageInfo = { code: string; beta?: boolean } | null;

const LANGUAGE_MAP: Record<string, LanguageInfo> = {
  en: { code: "EN" },
  ja: { code: "JA" },
  ko: { code: "KO" },
  hi: { code: "HI", beta: true },
  bn: { code: "BN", beta: true },
  pa: { code: "PA", beta: true },
  ta: { code: "TA", beta: true },
  ur: { code: "UR", beta: true },
};

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

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10_000;
const rateMap = new Map<string, number[]>();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cache = new Map<string, { value: string; expiresAt: number }>();

const getClientKey = (headers: RequestLike["headers"]) => {
  const forwarded = getHeader(headers, "x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return getHeader(headers, "x-real-ip") ?? "anonymous";
};

const isRateLimited = (key: string) => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const existing = rateMap.get(key)?.filter((ts) => ts > windowStart) ?? [];
  existing.push(now);
  rateMap.set(key, existing);
  return existing.length > RATE_LIMIT_MAX;
};

const cacheKey = (text: string, to: string) => `${to}::${text}`;

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  if (!DEEPL_KEY) {
    res.status(500).json({
      error: "DeepL credentials are missing. Set DEEPL_API_KEY (and optionally DEEPL_API_ENDPOINT).",
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

  const targetLangInfo = LANGUAGE_MAP[to];
  if (!targetLangInfo) {
    res.status(400).json({ error: "Selected language is not supported by DeepL." });
    return;
  }
  const targetLang = targetLangInfo.code;
  const targetIsBeta = Boolean(targetLangInfo.beta);

  const clientKey = getClientKey(req.headers);
  if (isRateLimited(clientKey)) {
    res.status(429).json({ error: "Too many translation requests. Please wait a few seconds and try again." });
    return;
  }

  // Serve cached translations and collect missing texts
  const translations: Record<string, string> = {};
  const missing: string[] = [];
  const now = Date.now();

  for (const text of texts) {
    const key = cacheKey(text, to);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      translations[text] = cached.value;
    } else {
      missing.push(text);
    }
  }

  if (missing.length === 0) {
    res.status(200).json({ translations, target: to, cache: true });
    return;
  }

  try {
    const params = new URLSearchParams();
    params.append("target_lang", targetLang);
    const sourceInfo = from && ALLOWED_LANGUAGES.has(from) ? LANGUAGE_MAP[from] : LANGUAGE_MAP["en"];
    if (sourceInfo?.code) {
      params.append("source_lang", sourceInfo.code);
    }
    missing.forEach((text) => params.append("text", text));
    if (targetIsBeta || sourceInfo?.beta) {
      params.append("enable_beta_languages", "1");
    }

    const response = await fetch(DEEPL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({ error: text || "Translation request failed" });
      return;
    }

    const data = (await response.json()) as {
      translations?: Array<{ text: string; detected_source_language?: string }>;
      message?: string;
    };

    const deeplTranslations = data?.translations ?? [];
    deeplTranslations.forEach((item, index) => {
      const source = missing[index];
      const translated = item?.text;
      const value = translated ?? source;
      translations[source] = value;
      cache.set(cacheKey(source, to), { value, expiresAt: Date.now() + CACHE_TTL_MS });
    });

    res.status(200).json({ translations, target: to });
  } catch (error: any) {
    console.error("DeepL translation error:", error);
    res.status(500).json({ error: "Failed to translate text" });
  }
}
