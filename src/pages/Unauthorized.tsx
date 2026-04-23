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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">You don't have permission to access this page.</p>
          <Button onClick={goToDashboard}>Go to Dashboard</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Unauthorized;
