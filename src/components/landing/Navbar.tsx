import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Globe } from "lucide-react";

const Navbar = () => {
  const { lang, setLang, t } = useLanguage();

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="MWRD" className="w-9 h-9 rounded-lg object-cover" />
          <span className="font-display font-bold text-xl text-foreground tracking-tight">MWRD</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Globe className="w-4 h-4" />
            {lang === "en" ? "عربي" : "EN"}
          </button>
          <Button variant="nav-outline" size="sm" asChild>
            <Link to="/login">{t.nav.login}</Link>
          </Button>
          <Button variant="nav" size="sm" asChild>
            <Link to="/get-started">{t.nav.getStarted}</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
