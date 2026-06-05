// Public evaluation placeholder.
// The private production database admin client is intentionally not included.

function unavailable(): never {
  throw new Error("Public demo package does not include the production database admin client.");
}

export const supabaseAdmin = new Proxy({}, {
  get() {
    unavailable();
  },
}) as never;
