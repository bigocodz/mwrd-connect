import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();
  return (
    <footer className="bg-primary border-t border-primary-foreground/10 py-8">
      <div className="container mx-auto px-4 text-center text-primary-foreground/50 text-sm">
        © {new Date().getFullYear()} MWRD. {t.footer.rights}
      </div>
    </footer>
  );
};

export default Footer;
