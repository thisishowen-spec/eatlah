import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  text: z.string().min(1).max(2000),
  lang: z.enum(["zh", "en"]),
});

export const synthesizeTts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => ({
    kind: "demo" as const,
    message: "Public demo package does not call the private voice service.",
    text: data.text,
  }));
