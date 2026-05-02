/**
 * Client team management. Owner profiles can invite colleagues into their
 * org; invited users get CLIENT profiles whose `parent_client_id` points
 * back at the owner. All shared org data (RFQs, orders, cost centers, etc.)
 * keys on the owner's profile id, so every team member sees the same org.
 *
 * team_role gates which mutations a member is allowed to run on shared
 * data:
 *   - OWNER:    full control (the original signup)
 *   - ADMIN:    can manage the team and every org action
 *   - BUYER:    can browse, build RFQs, place orders
 *   - APPROVER: can sit in the approval tree and approve/reject
 *   - VIEWER:   read-only across org data
 */
import { action, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { getClientOrgId, requireClient } from "./lib";
import { logAction } from "./audit";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TEAM_ROLE = v.union(
  v.literal("OWNER"),
  v.literal("ADMIN"),
  v.literal("BUYER"),
  v.literal("APPROVER"),
  v.literal("VIEWER"),
);

const INVITABLE_ROLE = v.union(
  v.literal("BUYER"),
  v.literal("APPROVER"),
  v.literal("VIEWER"),
);

/** Returns true if the actor can manage team membership (invite/edit/remove). */
const canManageTeam = (teamRole: string | undefined) =>
  teamRole === "OWNER" || teamRole === "ADMIN" || teamRole === undefined;
// Note: undefined is treated as OWNER here — every legacy CLIENT profile
// (created before this feature) is implicitly the owner of its own org and
// should have full team-management rights.

const requireTeamManager = async (ctx: any) => {
  const profile = await requireClient(ctx);
  if (!canManageTeam(profile.team_role)) {
    throw new ConvexError("Forbidden — only org owner or team admin can do this");
  }
  return profile;
};

export const listMyTeam = query({
  handler: async (ctx) => {
    const orgId = await getClientOrgId(ctx);
    // The org "owner" is always the profile whose own _id == orgId. Their
    // parent_client_id is null. Team members live under by_parent_client.
    const owner = await ctx.db.get(orgId);
    const members = await ctx.db
      .query("profiles")
      .withIndex("by_parent_client", (q) => q.eq("parent_client_id", orgId))
      .collect();
    return [
      ...(owner
        ? [
            {
              ...owner,
              team_role: owner.team_role ?? "OWNER",
            },
          ]
        : []),
      ...members,
    ];
  },
});

export const inviteMember = action({
  args: {
    email: v.string(),
    full_name: v.string(),
    team_role: INVITABLE_ROLE,
    job_title: v.optional(v.string()),
    phone: v.optional(v.string()),
    temp_password: v.string(),
  },
  handler: async (ctx, args): Promise<{ public_id: string | null }> => {
    // Auth + permission: caller must be a team manager (OWNER or ADMIN).
    const myProfile = await ctx.runQuery(internal.users.getMyProfileInternal);
    if (!myProfile) throw new ConvexError("Unauthorized");
    if (myProfile.role !== "CLIENT") {
      throw new ConvexError("Only client orgs can invite team members");
    }
    if (!canManageTeam(myProfile.team_role)) {
      throw new ConvexError("Forbidden — only owner or team admin can invite");
    }
    const orgId = (myProfile.parent_client_id ?? myProfile._id) as Id<"profiles">;

    if (
      args.temp_password.length < 8 ||
      !/[a-z]/.test(args.temp_password) ||
      !/[A-Z]/.test(args.temp_password) ||
      !/\d/.test(args.temp_password)
    ) {
      throw new ConvexError(
        "Password must be 8+ chars with upper, lower, and a number",
      );
    }

    // Stash invite metadata for the auth callback to consume on signup.
    await ctx.runMutation(internal.admin.storePendingUserRole, {
      email: args.email,
      role: "CLIENT",
      // Reuse the org's company_name. This isn't displayed for team members
      // (they have full_name), but the auth callback expects a value.
      company_name: myProfile.company_name ?? "MWRD Client",
      parent_client_id: orgId,
      team_role: args.team_role,
      full_name: args.full_name,
      job_title: args.job_title,
      phone: args.phone,
    });

    await ctx.runAction(api.auth.signIn, {
      provider: "password",
      params: {
        email: args.email,
        password: args.temp_password,
        flow: "signUp",
      },
    });

    const newProfile = await ctx.runQuery(internal.admin.getProfileByEmail, {
      email: args.email,
    });

    // Send invitation email to the new member.
    const portalUrl = process.env.MWRD_PORTAL_URL ?? "https://app.mwrd.sa";
    const loginUrl = `${portalUrl.replace(/\/+$/, "")}/login`;
    const inviterName = myProfile.full_name ?? myProfile.company_name ?? "Your organisation";
    const roleLabel: Record<string, string> = {
      BUYER: "Buyer",
      APPROVER: "Approver",
      VIEWER: "Viewer",
    };
    const roleName = roleLabel[args.team_role] ?? args.team_role;

    const subject = `You've been invited to join ${inviterName} on MWRD`;
    const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<body style="font-family:-apple-system,system-ui,'IBM Plex Sans',sans-serif;background:#f5f5f0;padding:24px;color:#1a1a1a;">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%"
    style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
    <tr><td>
      <p style="margin:0 0 8px;color:#8a8a85;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;">MWRD</p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">You're invited!</h1>
      <p style="margin:0 0 12px;line-height:1.55;color:#3a3a3a;">
        Hi <strong>${escapeHtml(args.full_name)}</strong>,<br>
        <strong>${escapeHtml(inviterName)}</strong> has invited you to join their organisation
        on the <strong>MWRD</strong> procurement portal as a <strong>${escapeHtml(roleName)}</strong>.
      </p>
      <p style="margin:0 0 12px;line-height:1.55;color:#3a3a3a;">Use the credentials below to sign in:</p>
      <table role="presentation" cellspacing="0" cellpadding="0"
        style="background:#f5f5f0;border-radius:8px;padding:16px 20px;margin-bottom:20px;width:100%;">
        <tr>
          <td style="padding:4px 0;color:#8a8a85;font-size:13px;width:120px;">Email</td>
          <td style="padding:4px 0;font-weight:600;font-size:13px;">${escapeHtml(args.email)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#8a8a85;font-size:13px;">Temporary password</td>
          <td style="padding:4px 0;font-weight:600;font-size:13px;font-family:monospace;">${escapeHtml(args.temp_password)}</td>
        </tr>
      </table>
      <p style="margin:0 0 20px;line-height:1.55;color:#3a3a3a;">
        You will be asked to set a new password on your first login.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${loginUrl}"
          style="display:inline-block;padding:12px 24px;background:#ff6d43;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
          Sign in to MWRD
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #ece7e1;margin:0 0 16px;">
      <p style="margin:0;color:#8a8a85;font-size:12px;">
        You're receiving this because ${escapeHtml(inviterName)} added you as a team member.
        If you weren't expecting this invitation, you can safely ignore this email.
      </p>
    </td></tr>
  </table>
</body>
</html>`;

    // Best-effort — don't fail the invite if email delivery fails.
    try {
      await ctx.runAction(internal.email.send, {
        to: args.email,
        subject,
        html,
      });
    } catch (_emailErr) {
      // Email failure is non-fatal; the account is already created.
      console.warn("Team invite email failed to send:", _emailErr);
    }

    return { public_id: newProfile?.public_id ?? null };
  },
});

export const updateMemberRole = mutation({
  args: {
    member_id: v.id("profiles"),
    team_role: INVITABLE_ROLE,
  },
  handler: async (ctx, args) => {
    const me = await requireTeamManager(ctx);
    const orgId = me.parent_client_id ?? me._id;
    const member = await ctx.db.get(args.member_id);
    if (!member) throw new ConvexError("Member not found");
    if (member.parent_client_id !== orgId) {
      throw new ConvexError("Member does not belong to your org");
    }
    if (member.team_role === "OWNER") {
      throw new ConvexError("Cannot change the owner's role");
    }
    await ctx.db.patch(args.member_id, { team_role: args.team_role });
    await logAction(ctx, {
      action: "client_team.role.update",
      target_type: "profile",
      target_id: args.member_id,
      before: { team_role: member.team_role },
      after: { team_role: args.team_role },
    });
  },
});

export const updateMemberDetails = mutation({
  args: {
    member_id: v.id("profiles"),
    full_name: v.optional(v.string()),
    job_title: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireTeamManager(ctx);
    const orgId = me.parent_client_id ?? me._id;
    const member = await ctx.db.get(args.member_id);
    if (!member) throw new ConvexError("Member not found");
    if (member._id !== orgId && member.parent_client_id !== orgId) {
      throw new ConvexError("Member does not belong to your org");
    }
    await ctx.db.patch(args.member_id, {
      full_name: args.full_name?.trim() || undefined,
      job_title: args.job_title?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
    });
    await logAction(ctx, {
      action: "client_team.details.update",
      target_type: "profile",
      target_id: args.member_id,
    });
  },
});

export const deactivateMember = mutation({
  args: { member_id: v.id("profiles") },
  handler: async (ctx, args) => {
    const me = await requireTeamManager(ctx);
    const orgId = me.parent_client_id ?? me._id;
    const member = await ctx.db.get(args.member_id);
    if (!member) throw new ConvexError("Member not found");
    if (member.parent_client_id !== orgId) {
      throw new ConvexError("Member does not belong to your org");
    }
    if (member.team_role === "OWNER") {
      throw new ConvexError("Cannot deactivate the owner");
    }
    await ctx.db.patch(args.member_id, { status: "DEACTIVATED" });
    await logAction(ctx, {
      action: "client_team.deactivate",
      target_type: "profile",
      target_id: args.member_id,
      before: { status: member.status },
      after: { status: "DEACTIVATED" },
    });
  },
});

export const reactivateMember = mutation({
  args: { member_id: v.id("profiles") },
  handler: async (ctx, args) => {
    const me = await requireTeamManager(ctx);
    const orgId = me.parent_client_id ?? me._id;
    const member = await ctx.db.get(args.member_id);
    if (!member) throw new ConvexError("Member not found");
    if (member.parent_client_id !== orgId) {
      throw new ConvexError("Member does not belong to your org");
    }
    await ctx.db.patch(args.member_id, { status: "ACTIVE" });
    await logAction(ctx, {
      action: "client_team.reactivate",
      target_type: "profile",
      target_id: args.member_id,
      before: { status: member.status },
      after: { status: "ACTIVE" },
    });
  },
});
