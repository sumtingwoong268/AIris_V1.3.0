import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { SUPPORTED_LANGUAGES } from "./useLanguagePreference";

type TranslationResponse = {
  translations: Record<string, string>;
  target?: string;
};

const originalTextMap = new WeakMap<Text, string>();
const translationCache = new Map<string, Map<string, string>>();

const STORAGE_PREFIX = "airis-translate-cache-";

const loadPersistedCache = (language: string): Map<string, string> => {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${language}`);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
};

const persistCache = (language: string, cache: Map<string, string>) => {
  if (typeof window === "undefined") return;
  const obj: Record<string, string> = {};
  cache.forEach((value, key) => {
    obj[key] = value;
  });
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${language}`, JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
};

const getCacheForLanguage = (language: string) => {
  let cache = translationCache.get(language);
  if (!cache) {
    cache = loadPersistedCache(language);
    translationCache.set(language, cache);
  }
  return cache;
};

const isMeaningfulText = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length < 2) return false;
  // Avoid translating purely numeric or punctuation strings
  return /[A-Za-z\u0080-\uFFFF]/.test(trimmed);
};

const collectTextNodes = (limit = 250) => {
  if (typeof document === "undefined") {
    return { nodes: [] as Text[], uniqueTexts: [] as string[] };
  }

  const nodes: Text[] = [];
  const unique = new Set<string>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      const parentElement = node.parentElement;
      if (parentElement?.closest("[data-no-translate='true']")) {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip script/style tags by checking parent element
      const parentName = parentElement?.tagName?.toLowerCase();
      if (parentName && ["script", "style", "noscript"].includes(parentName)) {
        return NodeFilter.FILTER_REJECT;
      }
      const text = node.nodeValue;
      if (!isMeaningfulText(text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current: Text | null = walker.nextNode() as Text | null;
  while (current && nodes.length < limit) {
    const original = current.nodeValue ?? "";
    if (!originalTextMap.has(current)) {
      originalTextMap.set(current, original);
    }
    const trimmed = original.trim();
    unique.add(trimmed);
    nodes.push(current);
    current = walker.nextNode() as Text | null;
  }

  return { nodes, uniqueTexts: Array.from(unique).slice(0, limit) };
};

const applyTranslations = (nodes: Text[], translations: Record<string, string>) => {
  nodes.forEach((node) => {
    const original = originalTextMap.get(node) ?? node.nodeValue ?? "";
    const key = original.trim();
    const translated = translations[key] ?? translations[original] ?? null;
    if (translated) {
      node.nodeValue = translated;
    }
  });
};

const isSupportedLanguage = (code: string) => SUPPORTED_LANGUAGES.some((lang) => lang.code === code);

export function usePageTranslation(language: string, ready: boolean, refreshKey?: string) {
  const { toast } = useToast();
  const [translating, setTranslating] = useState(false);
  const lastSignatureRef = useRef<string | null>(null);
  const previousLanguageRef = useRef<string | null>(null);
  const lastRequestRef = useRef<number>(0);
  const backoffUntilRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    if (!ready) return;
    if (!language || !isSupportedLanguage(language)) return;
    const signature = `${language}-${refreshKey ?? ""}`;
    if (lastSignatureRef.current === signature) return;
    lastSignatureRef.current = signature;
    let cancelled = false;

    const translateOnce = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      if (language === "en") {
        // Only reload if we previously translated away from English
        if (previousLanguageRef.current && previousLanguageRef.current !== "en" && typeof window !== "undefined") {
          previousLanguageRef.current = "en";
          lastSignatureRef.current = signature;
          window.location.reload();
          inFlightRef.current = false;
          return;
        }
        previousLanguageRef.current = "en";
        lastSignatureRef.current = signature;
        inFlightRef.current = false;
        return;
      }

      const attempts = [30, 180]; // slight delays to allow route content to render

      setTranslating(true);
      for (const delayMs of attempts) {
        if (cancelled) break;
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (cancelled) break;
        }

        const { nodes, uniqueTexts } = collectTextNodes();
        if (uniqueTexts.length === 0) {
          continue;
        }

        // Apply cached translations and find missing texts
        const cache = getCacheForLanguage(language);
        applyTranslations(nodes, Object.fromEntries(cache));

        const missing = uniqueTexts.filter((text) => !cache.has(text)).slice(0, 200);
        if (missing.length === 0) {
          continue;
        }

        const now = Date.now();
        if (backoffUntilRef.current && now < backoffUntilRef.current) {
          continue;
        }

        const sinceLast = now - lastRequestRef.current;
        if (sinceLast < 1000) {
          await new Promise((resolve) => setTimeout(resolve, 1000 - sinceLast));
          if (cancelled) break;
        }

        try {
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: missing, to: language, from: "en" }),
          });

          lastRequestRef.current = Date.now();

          if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 429) {
              backoffUntilRef.current = Date.now() + 15000;
            }
            throw new Error(errorText || "Translation failed");
          }

          const data = (await response.json()) as TranslationResponse;
          if (cancelled) break;

          Object.entries(data.translations || {}).forEach(([source, translated]) => {
            cache.set(source, translated);
          });
          persistCache(language, cache);
          applyTranslations(nodes, data.translations || {});
        } catch (error: any) {
          console.error("Page translation error:", error);
          toast({
            title: "Translation failed",
            description: error?.message || "Could not translate the page.",
            variant: "destructive",
          });
          break;
        }
      }

      if (!cancelled) {
        previousLanguageRef.current = language;
      }
      if (!cancelled) {
        setTranslating(false);
      }
      inFlightRef.current = false;
    };

    void translateOnce();

    return () => {
      cancelled = true;
      inFlightRef.current = false;
    };
  }, [language, ready, refreshKey, toast]);

  return { translating };
}
