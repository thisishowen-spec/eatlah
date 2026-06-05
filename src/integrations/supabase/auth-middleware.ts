import { createMiddleware } from "@tanstack/react-start";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

const demoQuery = {
  select() { return this; },
  insert() { return this; },
  update() { return this; },
  delete() { return this; },
  eq() { return this; },
  in() { return this; },
  gte() { return this; },
  like() { return this; },
  order() { return this; },
  limit() { return this; },
  maybeSingle: async () => ({ data: null, error: null }),
  single: async () => ({ data: null, error: null }),
  then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
    return Promise.resolve({ data: [], error: null }).then(resolve);
  },
};

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  return next({
    context: {
      userId: DEMO_USER_ID,
      supabase: { from: () => demoQuery },
    },
  });
});
