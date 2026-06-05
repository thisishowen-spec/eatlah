// Public evaluation placeholder.
// The demo app does not require a live Supabase client.

type Listener = (event: string, session: { user: null } | null) => void;

const subscription = { unsubscribe() {} };

export const supabase = {
  auth: {
    onAuthStateChange(_listener: Listener) {
      return { data: { subscription } };
    },
    async getUser() {
      return { data: { user: null }, error: null };
    },
    async signInWithOtp() {
      return { data: {}, error: null };
    },
    async verifyOtp() {
      return { data: {}, error: null };
    },
    async signOut() {
      return { error: null };
    },
    async signInWithPassword() {
      return { data: {}, error: null };
    },
    async signUp() {
      return { data: {}, error: null };
    },
  },
  from() {
    throw new Error("Public demo package uses mock server functions instead of a live database client.");
  },
} as const;
