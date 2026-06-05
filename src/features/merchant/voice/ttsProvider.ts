import type { VoiceLang } from "./types";

export type TtsProvider = {
  speak(text: string, lang: VoiceLang): Promise<void>;
};

/**
 * 浏览器原生 SpeechSynthesis 兜底实现。
 * 接入 AI Audio 后用 setTtsProvider() 覆盖即可。
 */
const browserTts: TtsProvider = {
  speak(text, lang) {
    return new Promise<void>((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
        return;
      }
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === "zh" ? "zh-CN" : "en-US";
        u.rate = 1;
        u.pitch = 1;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        // 防止排队叠音
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        // 安全兜底：最多 15s
        setTimeout(() => resolve(), 15000);
      } catch {
        resolve();
      }
    });
  },
};

let current: TtsProvider = browserTts;

export function setTtsProvider(provider: TtsProvider) {
  current = provider;
}

export function resetTtsProvider() {
  current = browserTts;
}

export function speak(text: string, lang: VoiceLang) {
  return current.speak(text, lang);
}
