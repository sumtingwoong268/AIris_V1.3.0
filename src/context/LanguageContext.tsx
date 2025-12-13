import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "bn", label: "বাংলা (Bangla)" },
  { code: "ko", label: "한국어 (Korean)" },
] as const;

export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["code"];

const translationTable = {
  en: {
    "nav.friends": "Friends",
    "nav.achievements": "Achievements",
    "nav.reports": "Reports",
    "nav.statistics": "Statistics",
    "nav.blogs": "Blogs",
    "nav.profile": "Profile",
    "nav.language": "Language",
    "profile.preferredLanguage": "Preferred Language",
    "profile.preferredLanguageHelper": "Used to personalize your experience across AIris.",
    "actions.saveChanges": "Save Changes",
    "actions.signOut": "Sign Out",
  },
  hi: {
    "nav.friends": "मित्र",
    "nav.achievements": "उपलब्धियाँ",
    "nav.reports": "रिपोर्ट्स",
    "nav.statistics": "आँकड़े",
    "nav.blogs": "ब्लॉग",
    "nav.profile": "प्रोफ़ाइल",
    "nav.language": "भाषा",
    "profile.preferredLanguage": "पसंदीदा भाषा",
    "profile.preferredLanguageHelper": "AIris अनुभव को आपकी भाषा में ढालने के लिए।",
    "actions.saveChanges": "बदलाव सहेजें",
    "actions.signOut": "साइन आउट",
  },
  mr: {
    "nav.friends": "मित्र",
    "nav.achievements": "कामगिरी",
    "nav.reports": "अहवाल",
    "nav.statistics": "आकडेवारी",
    "nav.blogs": "ब्लॉग्स",
    "nav.profile": "प्रोफाइल",
    "nav.language": "भाषा",
    "profile.preferredLanguage": "प्राधान्य भाषा",
    "profile.preferredLanguageHelper": "AIris ला आपल्या भाषेत अनुभवण्यासाठी.",
    "actions.saveChanges": "बदल जतन करा",
    "actions.signOut": "साइन आउट",
  },
  pa: {
    "nav.friends": "ਦੋਸਤ",
    "nav.achievements": "ਉਪਲਬਧੀਆਂ",
    "nav.reports": "ਰਿਪੋਰਟਾਂ",
    "nav.statistics": "ਅੰਕੜੇ",
    "nav.blogs": "ਬਲੌਗ",
    "nav.profile": "ਪ੍ਰੋਫ਼ਾਈਲ",
    "nav.language": "ਭਾਸ਼ਾ",
    "profile.preferredLanguage": "ਪਸੰਦੀਦਾ ਭਾਸ਼ਾ",
    "profile.preferredLanguageHelper": "AIris ਅਨੁਭਵ ਨੂੰ ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਵਿੱਚ ਲਿਆਉਣ ਲਈ।",
    "actions.saveChanges": "ਬਦਲਾਅ ਸੰਭਾਲੋ",
    "actions.signOut": "ਸਾਈਨ ਆਉਟ",
  },
  ta: {
    "nav.friends": "நண்பர்கள்",
    "nav.achievements": "சாதனைகள்",
    "nav.reports": "அறிக்கைகள்",
    "nav.statistics": "புள்ளிவிவரங்கள்",
    "nav.blogs": "வலைப்பதிவுகள்",
    "nav.profile": "சுயவிவரம்",
    "nav.language": "மொழி",
    "profile.preferredLanguage": "விருப்ப மொழி",
    "profile.preferredLanguageHelper": "AIris அனுபவத்தை உங்கள் மொழியில் வடிவமைக்க.",
    "actions.saveChanges": "மாற்றங்களைச் சேமிக்கவும்",
    "actions.signOut": "வெளியேறு",
  },
  bn: {
    "nav.friends": "বন্ধুরা",
    "nav.achievements": "অর্জনসমূহ",
    "nav.reports": "প্রতিবেদন",
    "nav.statistics": "পরিসংখ্যান",
    "nav.blogs": "ব্লগ",
    "nav.profile": "প্রোফাইল",
    "nav.language": "ভাষা",
    "profile.preferredLanguage": "পছন্দের ভাষা",
    "profile.preferredLanguageHelper": "AIris-কে আপনার ভাষায় ব্যক্তিগতকরণ করতে।",
    "actions.saveChanges": "পরিবর্তন সংরক্ষণ করুন",
    "actions.signOut": "সাইন আউট",
  },
  ko: {
    "nav.friends": "친구",
    "nav.achievements": "업적",
    "nav.reports": "리포트",
    "nav.statistics": "통계",
    "nav.blogs": "블로그",
    "nav.profile": "프로필",
    "nav.language": "언어",
    "profile.preferredLanguage": "선호 언어",
    "profile.preferredLanguageHelper": "AIris 경험을 선호하는 언어로 설정합니다.",
    "actions.saveChanges": "변경 사항 저장",
    "actions.signOut": "로그아웃",
  },
} as const satisfies Record<LanguageCode, Record<string, string>>;

type TranslationKey = keyof typeof translationTable["en"];

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: TranslationKey) => string;
  options: typeof LANGUAGE_OPTIONS;
};

const STORAGE_KEY = "airis-language";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const isLanguageCode = (value: string | null): value is LanguageCode =>
  LANGUAGE_OPTIONS.some((option) => option.code === value);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved && isLanguageCode(saved)) {
      setLanguageState(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
  }, [language]);

  const setLanguage = (code: LanguageCode) => {
    setLanguageState(code);
  };

  const t = (key: TranslationKey) => {
    const translation = translationTable[language]?.[key] ?? translationTable.en[key];
    return translation ?? key;
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      options: LANGUAGE_OPTIONS,
    }),
    [language, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
