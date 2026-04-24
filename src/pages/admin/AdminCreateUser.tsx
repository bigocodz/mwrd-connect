import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShoppingCart, Package, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const AdminCreateUser = () => {
  const navigate = useNavigate();
  const createUser = useAction(api.admin.createUser);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState<"CLIENT" | "SUPPLIER">("CLIENT");
  const [tempPassword, setTempPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      tempPassword.length < 8 ||
      !/[a-z]/.test(tempPassword) ||
      !/[A-Z]/.test(tempPassword) ||
      !/\d/.test(tempPassword)
    ) {
      toast.error("Password must be 8+ characters with upper, lower, and a number");
      return;
    }
    setLoading(true);
    try {
      const publicId = await createUser({ email, password: tempPassword, role, company_name: companyName });
      toast.success(`User created: ${publicId}`);
      navigate("/admin/users");
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Users
      </Link>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Create New User</CardTitle>
          <CardDescription>Manually onboard a client or supplier</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Role</Label>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as "CLIENT" | "SUPPLIER")} className="grid grid-cols-2 gap-3">
                <Label htmlFor="cr-client" className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 cursor-pointer transition-all ${role === "CLIENT" ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"}`}>
                  <RadioGroupItem value="CLIENT" id="cr-client" className="sr-only" />
                  <ShoppingCart className="w-5 h-5 text-accent" />
                  <span className="font-medium text-sm">Client</span>
                </Label>
                <Label htmlFor="cr-supplier" className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 cursor-pointer transition-all ${role === "SUPPLIER" ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"}`}>
                  <RadioGroupItem value="SUPPLIER" id="cr-supplier" className="sr-only" />
                  <Package className="w-5 h-5 text-accent" />
                  <span className="font-medium text-sm">Supplier</span>
                </Label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password</Label>
              <Input id="password" type="text" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} required minLength={8} placeholder="Min 8 chars, upper + lower + number" />
              <p className="text-xs text-muted-foreground">Requires 8+ characters with uppercase, lowercase, and a number. The user should change this after first login.</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Create User
            </Button>
          </form>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminCreateUser;
