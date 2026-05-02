import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@cvx/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Package, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Role = "CLIENT" | "SUPPLIER" | "AUDITOR";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (publicId: string) => void;
}

const ROLE_TILES: { value: Role; icon: typeof ShoppingCart; labelKey: string }[] = [
  { value: "CLIENT", icon: ShoppingCart, labelKey: "Client" },
  { value: "SUPPLIER", icon: Package, labelKey: "Supplier" },
  { value: "AUDITOR", icon: ShieldCheck, labelKey: "Auditor" },
];

const validatePassword = (pw: string) =>
  pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw);

const CreateUserDialog = ({ open, onOpenChange, onCreated }: CreateUserDialogProps) => {
  const { tr } = useLanguage();
  const createUser = useAction(api.admin.createUser);

  const [role, setRole] = useState<Role>("CLIENT");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setRole("CLIENT");
    setCompanyName("");
    setEmail("");
    setTempPassword("");
    setShowPassword(false);
  };

  const handleClose = (next: boolean) => {
    if (loading) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const generatePassword = () => {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghjkmnpqrstuvwxyz";
    const digits = "23456789";
    const all = upper + lower + digits;
    const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
    let pw = pick(upper) + pick(lower) + pick(digits);
    for (let i = 0; i < 9; i++) pw += pick(all);
    setTempPassword(
      pw
        .split("")
        .sort(() => Math.random() - 0.5)
        .join(""),
    );
    setShowPassword(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error(tr("Company name is required"));
      return;
    }
    if (!email.trim()) {
      toast.error(tr("Email is required"));
      return;
    }
    if (!validatePassword(tempPassword)) {
      toast.error(
        tr("Password must be 8+ characters with upper, lower, and a number"),
      );
      return;
    }
    setLoading(true);
    try {
      const publicId = await createUser({
        email: email.trim(),
        password: tempPassword,
        role,
        company_name: companyName.trim(),
      });
      toast.success(tr("User created: {id}", { id: publicId ?? "—" }));
      onCreated?.(publicId ?? "");
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? tr("Failed to create user"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tr("Create New User")}</DialogTitle>
          <DialogDescription>
            {tr("Manually onboard a client or supplier")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label>{tr("Role")}</Label>
            <div className="grid grid-cols-3 gap-2.5">
              {ROLE_TILES.map((tile) => {
                const Icon = tile.icon;
                const selected = role === tile.value;
                return (
                  <button
                    key={tile.value}
                    type="button"
                    onClick={() => setRole(tile.value)}
                    className={`group flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-3.5 transition-all ${
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${selected ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span
                      className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}
                    >
                      {tr(tile.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>
            {role === "AUDITOR" && (
              <p className="text-xs text-muted-foreground">
                {tr(
                  "Read-only external audit account. Sees the same admin surfaces but cannot edit anything.",
                )}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-company">
              {role === "AUDITOR" ? tr("Auditor / Firm Name") : tr("Company Name")}
            </Label>
            <Input
              id="cu-company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-email">{tr("Email")}</Label>
            <Input
              id="cu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="cu-password">{tr("Temporary Password")}</Label>
              <button
                type="button"
                onClick={generatePassword}
                className="text-xs text-primary hover:underline"
              >
                {tr("Generate")}
              </button>
            </div>
            <div className="relative">
              <Input
                id="cu-password"
                type={showPassword ? "text" : "password"}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
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
              {tr(
                "User must change this password on first login.",
              )}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              {tr("Cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
              {tr("Create User")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserDialog;
