import { useLang } from "../i18n/LanguageContext";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={`prelogin-language-toggle${compact ? " compact" : ""}`}
      role="group"
      aria-label="Language"
    >
      <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
        {compact ? "EN" : "English"}
      </button>
      <button className={lang === "zh" ? "active" : ""} onClick={() => setLang("zh")}>
        中文
      </button>
    </div>
  );
}
