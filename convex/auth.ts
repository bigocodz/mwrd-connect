import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import { MutationCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: Email({
        id: "password-reset",
        maxAge: 60 * 15, // 15 minutes
        async generateVerificationToken() {
          // 6-digit OTP to match the reset-code UX on the login screen.
          return String(Math.floor(100000 + Math.random() * 900000));
        },
        async sendVerificationRequest({ identifier, token }) {
          const apiKey = process.env.RESEND_API_KEY;
          if (!apiKey) {
            throw new Error(
              "RESEND_API_KEY is not configured. Set it with: npx convex env set RESEND_API_KEY <key>",
            );
          }

          const from = process.env.RESEND_FROM ?? "MWRD <onboarding@resend.dev>";
          const subject = "MWRD password reset code";
          const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
              <h2 style="margin:0 0 12px">Password reset request</h2>
              <p style="margin:0 0 12px">Use this verification code to reset your MWRD password:</p>
              <p style="margin:0 0 12px;font-size:28px;font-weight:700;letter-spacing:4px">${token}</p>
              <p style="margin:0 0 8px">This code expires in 15 minutes.</p>
              <p style="margin:0;color:#6b7280">If you did not request this, you can ignore this email.</p>
            </div>
          `;

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              from,
              to: identifier,
              subject,
              html,
            }),
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Resend error ${res.status}: ${text}`);
          }
        },
      }),
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx: MutationCtx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }

      const userId = await ctx.db.insert("users", {
        email: args.profile.email as string | undefined,
        name: args.profile.name as string | undefined,
      });

      // Check if this is an admin-created account by looking for pending user role
      let role: "CLIENT" | "SUPPLIER" | "ADMIN" | "AUDITOR" = "CLIENT";
      let company_name: string | undefined;
      let adminCreated = false;

      const email = args.profile.email as string | undefined;
      if (email) {
        const pending = await ctx.db
          .query("pending_users")
          .withIndex("by_email", (q) => q.eq("email", email))
          .unique();

        if (pending) {
          role = pending.role;
          company_name = pending.company_name;
          adminCreated = true;
          // Clean up the pending user record
          await ctx.db.delete(pending._id);
        } else {
          // Normal self-signup uses the name field as company name
          company_name = args.profile.name as string | undefined;
        }
      } else {
        company_name = args.profile.name as string | undefined;
      }

      const existing = await ctx.db
        .query("profiles")
        .withIndex("by_role", (q) => q.eq("role", role))
        .collect();
      const count = existing.length + 1;
      const prefix =
        role === "CLIENT"
          ? "Client"
          : role === "SUPPLIER"
            ? "Supplier"
            : role === "AUDITOR"
              ? "Auditor"
              : "Admin";
      const public_id = `${prefix}-${String(count).padStart(4, "0")}`;

      // Auditors are admin-only-onboarded read-only accounts (PRD §13.4).
      // Activate them immediately on creation so they can start auditing
      // without going through the KYC funnel that doesn't apply.
      const isAuditor = role === "AUDITOR";

      await ctx.db.insert("profiles", {
        userId,
        role,
        status: isAuditor ? "ACTIVE" : "PENDING",
        kyc_status: isAuditor ? "VERIFIED" : "INCOMPLETE",
        company_name,
        public_id,
        credit_limit: 0,
        current_balance: 0,
        must_change_password: adminCreated ? true : undefined,
      });

      return userId;
    },
  },
});
