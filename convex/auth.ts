import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { MutationCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  callbacks: {
    async createOrUpdateUser(ctx: MutationCtx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }

      const userId = await ctx.db.insert("users", {
        email: args.profile.email as string | undefined,
        name: args.profile.name as string | undefined,
      });

      // Parse role/company_name from name field (used by admin-created accounts)
      let role: "CLIENT" | "SUPPLIER" | "ADMIN" = "CLIENT";
      let company_name: string | undefined;
      let adminCreated = false;
      const profileName = args.profile.name as string | undefined;
      try {
        const meta = JSON.parse(profileName ?? "");
        if (meta.role) role = meta.role;
        if (meta.company_name) company_name = meta.company_name;
        adminCreated = true;
      } catch {
        // name is a plain string, not JSON — normal self-signup
        company_name = profileName;
      }

      const existing = await ctx.db
        .query("profiles")
        .withIndex("by_role", (q) => q.eq("role", role))
        .collect();
      const count = existing.length + 1;
      const prefix = role === "CLIENT" ? "Client" : role === "SUPPLIER" ? "Supplier" : "Admin";
      const public_id = `${prefix}-${String(count).padStart(4, "0")}`;

      await ctx.db.insert("profiles", {
        userId,
        role,
        status: "PENDING",
        kyc_status: "INCOMPLETE",
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
