import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { tr } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8f7] px-4">
      <div className="max-w-md rounded-lg bg-white p-10 text-center shadow-[0_18px_44px_rgba(26,26,26,0.08),0_0_0_1px_rgba(190,184,174,0.34)]">
        <h1 className="mb-4 font-display text-[3.25rem] font-semibold leading-tight text-[#1a1a1a]">404</h1>
        <p className="mb-4 text-xl leading-relaxed text-[#5f625f]">{tr("Page not found")}</p>
        <a href="/" className="text-[#ff6d43] underline-offset-4 hover:underline">
          {tr("Return to Home")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
