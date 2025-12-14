import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { SUPPORTED_LANGUAGES } from "./useLanguagePreference";

type TranslationResponse = {
  translations: Record<string, string>;
  target?: string;
};

const originalTextMap = new WeakMap<Text, string>();

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
      // Skip script/style tags by checking parent element
      const parentName = node.parentElement?.tagName?.toLowerCase();
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
  const lastAppliedRef = useRef<string | null>(null);
  const previousLanguageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!language || !isSupportedLanguage(language)) return;
    const signature = `${language}-${refreshKey ?? ""}`;
    if (lastAppliedRef.current === signature) return;

    let cancelled = false;

    const run = async () => {
      if (language === "en") {
        // Only reload if we previously translated away from English
        if (previousLanguageRef.current && previousLanguageRef.current !== "en" && typeof window !== "undefined") {
          previousLanguageRef.current = "en";
          lastAppliedRef.current = signature;
          window.location.reload();
          return;
        }
        previousLanguageRef.current = "en";
        lastAppliedRef.current = signature;
        return;
      }

      const { nodes, uniqueTexts } = collectTextNodes();
      if (uniqueTexts.length === 0) {
        lastAppliedRef.current = signature;
        previousLanguageRef.current = language;
        return;
      }

      setTranslating(true);
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: uniqueTexts, to: language, from: "en" }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Translation failed");
        }

        const data = (await response.json()) as TranslationResponse;
        if (cancelled) return;

        applyTranslations(nodes, data.translations || {});
        lastAppliedRef.current = signature;
        previousLanguageRef.current = language;
      } catch (error: any) {
        console.error("Page translation error:", error);
        toast({
          title: "Translation failed",
          description: error?.message || "Could not translate the page.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) {
          setTranslating(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [language, ready, refreshKey, toast]);

  return { translating };
}
