import type { TtsProvider } from "./ttsProvider";

// Public evaluation placeholder: production voice synthesis is not included.
export const aurastdProvider: TtsProvider = {
  async speak() {
    return;
  },
};
