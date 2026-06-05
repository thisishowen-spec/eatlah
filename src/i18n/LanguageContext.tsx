import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { dict, type Lang } from "./dictionary";

/**
 * 在当前语言下从一对（中文 / 英文）动态字段里挑一个。
 * 任一为空自动降级到另一语言，两个都空返回 ""。
 * 注意：永远不要对动态业务数据（菜名、描述）使用 dictionary 翻译，应使用本函数。
 */
export function pickLang(zh: string | null | undefined, en: string | null | undefined, lang: Lang): string {
  const z = (zh ?? "").trim();
  const e = (en ?? "").trim();
  if (lang === "en") return e || z;
  return z || e;
}

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  t: (zh: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = "eatlah.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "zh";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "zh" ? stored : "zh";
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "zh" ? "en" : "zh";
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback(
    (zh: string) => {
      if (lang === "zh") return zh;
      return dict[zh] ?? zh;
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Safe fallback so any component used outside a provider still renders Chinese.
    return {
      lang: "zh",
      setLang: () => undefined,
      toggle: () => undefined,
      t: (zh: string) => zh,
    };
  }
  return ctx;
}
