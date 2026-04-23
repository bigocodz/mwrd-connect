import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const send = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY is not configured. Set it with: npx convex env set RESEND_API_KEY <key>",
      );
    }
    const from = process.env.RESEND_FROM ?? "MWRD <onboarding@resend.dev>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend error ${res.status}: ${text}`);
    }
  },
});
