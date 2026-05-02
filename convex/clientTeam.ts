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
