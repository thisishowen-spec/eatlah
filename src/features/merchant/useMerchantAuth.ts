import { useCallback, useEffect, useState } from "react";

const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const STORAGE_KEY = "eatlah-public-demo-auth";

type AuthStatus = "loading" | "anonymous" | "authenticated";
type DemoUser = { id: string; phone?: string; email?: string };

export function useMerchantAuth() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setStatus("anonymous");
      return;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DemoUser;
        setUser(parsed);
        setStatus("authenticated");
        return;
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setStatus("anonymous");
  }, []);

  const finishLogin = useCallback((patch: Omit<DemoUser, "id"> = {}) => {
    const next = { id: DEMO_USER_ID, ...patch };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    setUser(next);
    setStatus("authenticated");
  }, []);

  const signInWithPhone = useCallback(async (localPhone: string, dialCode: string = "+65") => {
    return dialCode + localPhone.replace(/\D/g, "");
  }, []);

  const verifyOtp = useCallback(async (localPhone: string, _code: string, dialCode: string = "+65") => {
    finishLogin({ phone: dialCode + localPhone.replace(/\D/g, "") });
  }, [finishLogin]);

  const signOut = useCallback(async () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const signInWithGoogle = useCallback(async () => {
    finishLogin({ email: "merchant@example.com" });
  }, [finishLogin]);

  const signInWithEmail = useCallback(async (email: string, _password: string) => {
    finishLogin({ email });
  }, [finishLogin]);

  const signUpWithEmail = useCallback(async (email: string, _password: string) => {
    finishLogin({ email });
  }, [finishLogin]);

  return { status, user, signInWithPhone, verifyOtp, signOut, signInWithGoogle, signInWithEmail, signUpWithEmail };
}
