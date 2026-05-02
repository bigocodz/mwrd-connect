import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Loader2,
  Plus,
  ShieldCheck,
  ShoppingCart,
  CheckCheck,
  Eye,
  Crown,
  UserX,
  RotateCcw,
  EyeOff,
} from "lucide-react";

type TeamRole = "OWNER" | "ADMIN" | "BUYER" | "APPROVER" | "VIEWER";
type InvitableRole = "BUYER" | "APPROVER" | "VIEWER";

interface Member {
  _id: Id<"profiles">;
  full_name?: string;
  job_title?: string;
  phone?: string;
  company_name?: string;
  public_id?: string;
  team_role?: TeamRole;
  status: string;
  parent_client_id?: Id<"profiles">;
  must_change_password?: boolean;
}

const roleMeta: Record<TeamRole, { icon: any; tone: string; descKey: string }> = {
  OWNER: {
    icon: Crown,
    tone: "text-amber-600",
    descKey: "Org account holder. Full control.",
  },
  ADMIN: {
    icon: ShieldCheck,
    tone: "text-primary",
    descKey: "Manage team and every org action.",
  },
  BUYER: {
    icon: ShoppingCart,
    tone: "text-blue-600",
    descKey: "Browse, build RFQs, place orders.",
  },
  APPROVER: {
    icon: CheckCheck,
    tone: "text-green-600",
    descKey: "Reviews and approves orders in the approval tree.",
  },
  VIEWER: {
    icon: Eye,
    tone: "text-muted-foreground",
    descKey: "Read-only access to all org data.",
  },
};

const generatePassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = pick(upper) + pick(lower) + pick(digits);
  for (let i = 0; i < 9; i++) pw += pick(all);
  return pw
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

const validatePassword = (pw: string) =>
  pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw);

const ClientTeam = () => {
  const { tr } = useLanguage();
  const { profile } = useAuth();
  const data = useQuery(api.clientTeam.listMyTeam) as Member[] | undefined;
  const inviteMember = useAction(api.clientTeam.inviteMember);
  const updateRole = useMutation(api.clientTeam.updateMemberRole);
  const deactivate = useMutation(api.clientTeam.deactivateMember);
  const reactivate = useMutation(api.clientTeam.reactivateMember);

  const myTeamRole = (profile?.team_role as TeamRole | undefined) ?? "OWNER";
  const canManage = myTeamRole === "OWNER" || myTeamRole === "ADMIN";

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteJobTitle, setInviteJobTitle] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableRole>("BUYER");
  const [invitePassword, setInvitePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const members = useMemo(() => {
    if (!data) return [] as Member[];
    return [...data].sort((a, b) => {
      const order: Record<TeamRole, number> = {
        OWNER: 0,
        ADMIN: 1,
        APPROVER: 2,
        BUYER: 3,
        VIEWER: 4,
      };
      const ra = order[(a.team_role ?? "OWNER") as TeamRole] ?? 99;
      const rb = order[(b.team_role ?? "OWNER") as TeamRole] ?? 99;
      return ra - rb;
    });
  }, [data]);

  const reset = () => {
    setInviteEmail("");
    setInviteName("");
    setInviteJobTitle("");
    setInvitePhone("");
    setInviteRole("BUYER");
    setInvitePassword("");
    setShowPassword(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error(tr("Name and email are required"));
      return;
    }
    if (!validatePassword(invitePassword)) {
      toast.error(
        tr("Password must be 8+ characters with upper, lower, and a number"),
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await inviteMember({
        email: inviteEmail.trim(),
        full_name: inviteName.trim(),
        job_title: inviteJobTitle.trim() || undefined,
        phone: invitePhone.trim() || undefined,
        team_role: inviteRole,
        temp_password: invitePassword,
      });
      toast.success(
        tr("Member invited: {id}", { id: result.public_id ?? "—" }),
      );
      reset();
      setInviteOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? tr("Failed to invite"));
    } finally {
      setSubmitting(false);
    }
  };

  const onChangeRole = async (
    member: Member,
    next: InvitableRole,
  ) => {
    try {
      await updateRole({ member_id: member._id, team_role: next });
      toast.success(tr("Role updated"));
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    }
  };

  const onDeactivate = async (member: Member) => {
    if (!confirm(tr("Deactivate this team member?"))) return;
    try {
      await deactivate({ member_id: member._id });
      toast.success(tr("Deactivated"));
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    }
  };

  const onReactivate = async (member: Member) => {
    try {
      await reactivate({ member_id: member._id });
      toast.success(tr("Reactivated"));
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    }
  };

  const loading = data === undefined;

  return (
    <ClientLayout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            {tr("Team & Permissions")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              "Invite colleagues into your organization and assign their role.",
            )}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="w-4 h-4 me-1.5" />
            {tr("Invite member")}
          </Button>
        )}
      </div>

      {!canManage && (
        <Card className="mb-4">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {tr(
              "You don't have permission to manage team members. Contact your org owner.",
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => {
            const role = (m.team_role ?? "OWNER") as TeamRole;
            const meta = roleMeta[role];
            const Icon = meta.icon;
            const isOwner = role === "OWNER";
            const isMe = m._id === profile?._id;
            return (
              <Card key={m._id}>
                <CardContent className="pt-6 flex items-center gap-4 flex-wrap">
                  <div
                    className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 ${meta.tone}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display text-base font-semibold text-foreground">
                        {m.full_name || m.company_name || tr("Team member")}
                      </p>
                      {isMe && (
                        <Badge variant="secondary" className="text-[10px]">
                          {tr("You")}
                        </Badge>
                      )}
                      {m.must_change_password && (
                        <Badge variant="outline" className="text-[10px]">
                          {tr("Pending password reset")}
                        </Badge>
                      )}
                      {m.status === "DEACTIVATED" && (
                        <Badge variant="destructive" className="text-[10px]">
                          {tr("Deactivated")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.public_id ? (
                        <span className="font-mono">{m.public_id}</span>
                      ) : null}
                      {m.job_title ? ` · ${m.job_title}` : ""}
                      {m.phone ? ` · ${m.phone}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tr(meta.descKey)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isOwner ? (
                      <Badge className="bg-amber-50 text-amber-800 border border-amber-200">
                        <Crown className="w-3 h-3 me-1" />
                        {tr("Owner")}
                      </Badge>
                    ) : canManage ? (
                      <Select
                        value={role}
                        onValueChange={(v) =>
                          onChangeRole(m, v as InvitableRole)
                        }
                        disabled={m.status === "DEACTIVATED"}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BUYER">{tr("Buyer")}</SelectItem>
                          <SelectItem value="APPROVER">
                            {tr("Approver")}
                          </SelectItem>
                          <SelectItem value="VIEWER">
                            {tr("Viewer")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{tr(role)}</Badge>
                    )}

                    {!isOwner && canManage ? (
                      m.status === "DEACTIVATED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReactivate(m)}
                        >
                          <RotateCcw className="w-3.5 h-3.5 me-1" />
                          {tr("Reactivate")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeactivate(m)}
                        >
                          <UserX className="w-4 h-4 text-destructive" />
                        </Button>
                      )
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          if (submitting) return;
          if (!o) reset();
          setInviteOpen(o);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr("Invite a team member")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Creates a sub-account under your organization. The invitee can sign in immediately and change their password on first login.",
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="im-name">{tr("Full name")} *</Label>
                <Input
                  id="im-name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="im-email">{tr("Email")} *</Label>
                <Input
                  id="im-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="im-title">{tr("Job title")}</Label>
                <Input
                  id="im-title"
                  value={inviteJobTitle}
                  onChange={(e) => setInviteJobTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="im-phone">{tr("Phone")}</Label>
                <Input
                  id="im-phone"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tr("Role")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["BUYER", "APPROVER", "VIEWER"] as InvitableRole[]).map(
                  (r) => {
                    const meta = roleMeta[r];
                    const Icon = meta.icon;
                    const sel = inviteRole === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInviteRole(r)}
                        className={`group flex flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 transition-all ${
                          sel
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${sel ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span
                          className={`text-xs font-medium ${sel ? "text-primary" : "text-foreground"}`}
                        >
                          {tr(r)}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {tr(roleMeta[inviteRole].descKey)}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="im-password">
                  {tr("Temporary Password")}
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setInvitePassword(generatePassword());
                    setShowPassword(true);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {tr("Generate")}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="im-password"
                  type={showPassword ? "text" : "password"}
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder={tr("Min 8 chars, upper + lower + number")}
                  className="pe-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={tr("Toggle password visibility")}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {tr("Member must change this password on first login.")}
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={submitting}
              >
                {tr("Cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin me-1.5" />
                ) : null}
                {tr("Send invite")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientTeam;
