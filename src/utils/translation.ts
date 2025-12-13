import type { LanguageCode } from "@/context/LanguageContext";

const CACHE_KEY = "airis-translation-cache";

type TranslationCache = Record<LanguageCode, Record<string, string>>;

const loadCache = (): TranslationCache => {
  if (typeof window === "undefined") return {} as TranslationCache;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as TranslationCache) : ({} as TranslationCache);
  } catch (error) {
    console.warn("Failed to parse translation cache", error);
    return {} as TranslationCache;
  }
};

const saveCache = (cache: TranslationCache) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn("Failed to persist translation cache", error);
  }
};

const cache = loadCache();

const translateText = async (text: string, target: LanguageCode, signal?: AbortSignal): Promise<string> => {
  const trimmed = text.trim();
  if (!trimmed || target === "en") return text;

  const cached = cache[target]?.[trimmed];
  if (cached) return cached;

  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${target}&dt=t&q=${encodeURIComponent(trimmed)}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const [translations] = payload;
  const translated = Array.isArray(translations)
    ? translations.map((entry: any) => (Array.isArray(entry) ? entry[0] ?? "" : "")).join("")
    : "";

  if (!cache[target]) cache[target] = {} as Record<string, string>;
  cache[target][trimmed] = translated || text;
  saveCache(cache);

  return translated || text;
};

const shouldSkipNode = (node: Text) => {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest("[data-translate-ignore]")) return true;
  const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "INPUT"]);
  return ignoredTags.has(parent.tagName);
};

const getTextNodes = (root: HTMLElement) => {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const textNode = current as Text;
    if (!shouldSkipNode(textNode) && textNode.textContent?.trim()) {
      nodes.push(textNode);
    }
    current = walker.nextNode();
  }
  return nodes;
};

export const translateTree = async (root: HTMLElement, target: LanguageCode, signal?: AbortSignal) => {
  const nodes = getTextNodes(root);
  const uniqueStrings = Array.from(
    new Set(
      nodes
        .map((node) => node.textContent?.trim() ?? "")
        .filter((value) => value && value.length > 1),
    ),
  );

  if (!uniqueStrings.length) return;

  const translations = await Promise.all(
    uniqueStrings.map(async (text) => ({ original: text, translated: await translateText(text, target, signal) })),
  );

  const translationMap = translations.reduce<Record<string, string>>((acc, item) => {
    acc[item.original] = item.translated;
    return acc;
  }, {});

  nodes.forEach((node) => {
    const content = node.textContent ?? "";
    const trimmed = content.trim();
    const translated = translationMap[trimmed];
    if (!translated) return;

    const leadingWhitespace = content.match(/^\s*/)?.[0] ?? "";
    const trailingWhitespace = content.match(/\s*$/)?.[0] ?? "";

    (node as any).__airisOriginalText = (node as any).__airisOriginalText ?? content;
    node.textContent = `${leadingWhitespace}${translated}${trailingWhitespace}`;
  });
};

export const restoreTree = (root: HTMLElement) => {
  const nodes = getTextNodes(root);
  nodes.forEach((node) => {
    const original = (node as any).__airisOriginalText as string | undefined;
    if (original !== undefined) {
      node.textContent = original;
      delete (node as any).__airisOriginalText;
    }
  });
};
