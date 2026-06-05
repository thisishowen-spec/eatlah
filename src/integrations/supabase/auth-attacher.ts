import { createMiddleware } from "@tanstack/react-start";

// Public evaluation placeholder: server functions use demo auth context.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => next());
