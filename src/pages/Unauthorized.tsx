import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Unauthorized = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const goToDashboard = () => {
    if (!profile) return navigate("/login");
    const dest = profile.role === "ADMIN" ? "/admin/dashboard"
      : profile.role === "SUPPLIER" ? "/supplier/dashboard"
      : "/client/dashboard";
    navigate(dest);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4ed] px-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8">
          <ShieldAlert className="mx-auto mb-4 h-16 w-16 text-[#b53333]" />
          <h2 className="mb-2 font-display text-[1.6rem] font-medium text-[#141413]">Access Denied</h2>
          <p className="mb-6 leading-relaxed text-[#5e5d59]">You don't have permission to access this page.</p>
          <Button onClick={goToDashboard}>Go to Dashboard</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Unauthorized;
