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
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4ed] px-4">
      <div className="max-w-md rounded-2xl bg-[#faf9f5] p-10 text-center shadow-[0_4px_24px_rgba(20,20,19,0.05),0_0_0_1px_#f0eee6]">
        <h1 className="mb-4 font-display text-[3.25rem] font-medium leading-tight text-[#141413]">404</h1>
        <p className="mb-4 text-xl leading-relaxed text-[#5e5d59]">{tr("Page not found")}</p>
        <a href="/" className="text-[#c96442] underline-offset-4 hover:underline">
          {tr("Return to Home")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
