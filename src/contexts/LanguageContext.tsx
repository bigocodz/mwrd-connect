import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { arStrings } from "@/i18n/ar";

type Lang = "en" | "ar";

type Translations = {
  nav: { login: string; getStarted: string };
  hero: {
    badge: string;
    title1: string;
    titleHighlight: string;
    desc: string;
    cta: string;
    ctaSecondary: string;
  };
  features: {
    verified: { label: string; desc: string };
    neutral: { label: string; desc: string };
    visibility: { label: string; desc: string };
  };
  howItWorks: {
    title: string;
    subtitle: string;
    steps: { number: string; title: string; desc: string }[];
  };
  whyMwrd: {
    title: string;
    subtitle: string;
    items: { title: string; desc: string }[];
  };
  stats: {
    title: string;
    items: { value: string; label: string }[];
  };
  cta: {
    title: string;
    desc: string;
    button: string;
  };
  footer: { rights: string };
  getStarted: {
    title: string;
    desc: string;
    fullName: string;
    fullNamePh: string;
    company: string;
    companyPh: string;
    crNumber: string;
    crNumberPh: string;
    vatNumber: string;
    vatNumberPh: string;
    email: string;
    emailPh: string;
    phone: string;
    phonePh: string;
    accountType: string;
    roleClient: string;
    roleSupplier: string;
    message: string;
    messagePh: string;
    submit: string;
    submitting: string;
    errorMsg: string;
    thankTitle: string;
    thankDesc: string;
    backHome: string;
  };
};

const translations: Record<Lang, Translations> = {
  en: {
    nav: { login: "Login", getStarted: "Get Started" },
    hero: {
      badge: "Managed B2B Marketplace",
      title1: "Your Neutral Broker for",
      titleHighlight: "B2B Trade",
      desc: "MWRD connects verified buyers and suppliers through a managed marketplace — facilitating procurement, logistics, and payments with full transparency.",
      cta: "Get Started",
      ctaSecondary: "Login to Portal",
    },
    features: {
      verified: { label: "Verified Partners", desc: "Every buyer and supplier is vetted" },
      neutral: { label: "Neutral Brokerage", desc: "Fair, transparent deal facilitation" },
      visibility: { label: "Full Visibility", desc: "Track orders, invoices & logistics" },
    },
    howItWorks: {
      title: "How It Works",
      subtitle: "Three simple steps to streamline your B2B trade",
      steps: [
        { number: "01", title: "Register & Get Verified", desc: "Submit your company details. Our team verifies your business credentials within 48 hours." },
        { number: "02", title: "Browse & Connect", desc: "Access our curated marketplace of verified buyers and suppliers. Find the perfect match for your needs." },
        { number: "03", title: "Trade with Confidence", desc: "We manage the entire deal flow — from negotiation to delivery — with full transparency at every step." },
      ],
    },
    whyMwrd: {
      title: "Why MWRD?",
      subtitle: "Built for businesses that demand transparency and efficiency",
      items: [
        { title: "End-to-End Management", desc: "From first contact to final delivery, we handle procurement, logistics, and payment processing." },
        { title: "Risk Mitigation", desc: "Verified counterparties, escrow payments, and dispute resolution protect every transaction." },
        { title: "Real-Time Tracking", desc: "Monitor every order, shipment, and invoice through your dedicated portal dashboard." },
        { title: "Dedicated Support", desc: "A personal account manager ensures smooth operations and resolves issues instantly." },
      ],
    },
    stats: {
      title: "Trusted by Growing Businesses",
      items: [
        { value: "500+", label: "Verified Partners" },
        { value: "$120M+", label: "Trade Facilitated" },
        { value: "98%", label: "Satisfaction Rate" },
        { value: "24/7", label: "Support Available" },
      ],
    },
    cta: {
      title: "Ready to Transform Your B2B Trade?",
      desc: "Join hundreds of verified businesses already trading on MWRD. Get started in minutes.",
      button: "Start Now — It's Free",
    },
    footer: { rights: "All rights reserved." },
    getStarted: {
      title: "Get Started with MWRD",
      desc: "Tell us about your company and how you'd like to participate in our marketplace.",
      fullName: "Full Name",
      fullNamePh: "John Doe",
      company: "Company Name",
      companyPh: "Acme Corp",
      crNumber: "Commercial Registration (CR) Number",
      crNumberPh: "e.g. 1010XXXXXX",
      vatNumber: "VAT Number",
      vatNumberPh: "e.g. 3XXXXXXXXXXXXXX",
      email: "Business Email",
      emailPh: "john@acme.com",
      phone: "Phone Number",
      phonePh: "+966 5X XXX XXXX",
      accountType: "Account Type",
      roleClient: "Buyer (Client)",
      roleSupplier: "Supplier",
      message: "Additional Notes (Optional)",
      messagePh: "Tell us about your business and needs...",
      submit: "Submit Interest",
      submitting: "Submitting...",
      errorMsg: "Something went wrong. Please try again.",
      thankTitle: "Thank You!",
      thankDesc: "Our team will review your application and contact you within 1–2 business days.",
      backHome: "Back to Home",
    },
  },
  ar: {
    nav: { login: "تسجيل الدخول", getStarted: "ابدأ الآن" },
    hero: {
      badge: "سوق B2B مُدار",
      title1: "وسيطك المحايد في",
      titleHighlight: "التجارة بين الشركات",
      desc: "MWRD يربط المشترين والموردين المعتمدين عبر سوق مُدار — لتسهيل المشتريات والخدمات اللوجستية والمدفوعات بشفافية كاملة.",
      cta: "ابدأ الآن",
      ctaSecondary: "الدخول إلى البوابة",
    },
    features: {
      verified: { label: "شركاء معتمدون", desc: "كل مشتري ومورد تم التحقق منه" },
      neutral: { label: "وساطة محايدة", desc: "تسهيل صفقات عادل وشفاف" },
      visibility: { label: "رؤية كاملة", desc: "تتبع الطلبات والفواتير والشحنات" },
    },
    howItWorks: {
      title: "كيف يعمل؟",
      subtitle: "ثلاث خطوات بسيطة لتبسيط تجارتك",
      steps: [
        { number: "٠١", title: "سجّل وتحقق", desc: "أرسل بيانات شركتك. فريقنا يتحقق من بيانات عملك خلال 48 ساعة." },
        { number: "٠٢", title: "تصفّح وتواصل", desc: "اطلع على سوقنا المنسّق من المشترين والموردين المعتمدين. اعثر على الشريك المناسب." },
        { number: "٠٣", title: "تداول بثقة", desc: "نحن ندير كامل سير الصفقة — من التفاوض حتى التسليم — بشفافية تامة في كل خطوة." },
      ],
    },
    whyMwrd: {
      title: "لماذا MWRD؟",
      subtitle: "مصمم للشركات التي تطلب الشفافية والكفاءة",
      items: [
        { title: "إدارة شاملة", desc: "من أول تواصل حتى التسليم النهائي، نتولى المشتريات والخدمات اللوجستية ومعالجة المدفوعات." },
        { title: "تخفيف المخاطر", desc: "أطراف معتمدة، مدفوعات ضمان، وحل النزاعات لحماية كل معاملة." },
        { title: "تتبع فوري", desc: "راقب كل طلب وشحنة وفاتورة عبر لوحة تحكم البوابة المخصصة." },
        { title: "دعم مخصص", desc: "مدير حساب شخصي يضمن سير العمليات بسلاسة وحل المشكلات فوراً." },
      ],
    },
    stats: {
      title: "موثوق من قبل الشركات النامية",
      items: [
        { value: "+٥٠٠", label: "شريك معتمد" },
        { value: "+١٢٠ مليون$", label: "حجم التداول" },
        { value: "٩٨%", label: "معدل الرضا" },
        { value: "٢٤/٧", label: "دعم متاح" },
      ],
    },
    cta: {
      title: "مستعد لتحويل تجارتك بين الشركات؟",
      desc: "انضم إلى مئات الشركات المعتمدة التي تتداول بالفعل على MWRD. ابدأ في دقائق.",
      button: "ابدأ الآن — مجاناً",
    },
    footer: { rights: "جميع الحقوق محفوظة." },
    getStarted: {
      title: "ابدأ مع MWRD",
      desc: "أخبرنا عن شركتك وكيف ترغب في المشاركة في سوقنا.",
      fullName: "الاسم الكامل",
      fullNamePh: "أحمد محمد",
      company: "اسم الشركة",
      companyPh: "شركة أكمي",
      crNumber: "رقم السجل التجاري",
      crNumberPh: "مثال: 1010XXXXXX",
      vatNumber: "الرقم الضريبي",
      vatNumberPh: "مثال: 3XXXXXXXXXXXXXX",
      email: "البريد الإلكتروني التجاري",
      emailPh: "ahmed@acme.com",
      phone: "رقم الهاتف",
      phonePh: "+966 5X XXX XXXX",
      accountType: "نوع الحساب",
      roleClient: "مشتري (عميل)",
      roleSupplier: "مورد",
      message: "ملاحظات إضافية (اختياري)",
      messagePh: "أخبرنا عن عملك واحتياجاتك...",
      submit: "إرسال الطلب",
      submitting: "جاري الإرسال...",
      errorMsg: "حدث خطأ. يرجى المحاولة مرة أخرى.",
      thankTitle: "شكراً لك!",
      thankDesc: "سيقوم فريقنا بمراجعة طلبك والتواصل معك خلال ١-٢ يوم عمل.",
      backHome: "العودة للرئيسية",
    },
  },
};

type LanguageContextType = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
  tr: (key: string, vars?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
};

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = "mwrd_lang";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "ar" ? "ar" : "en";
  });

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore persistence errors (private mode, storage denied).
    }
  };

  const t = useMemo(() => translations[lang], [lang]);
  const dir = lang === "ar" ? "rtl" : "ltr";

  const tr = useMemo(() => {
    const table = lang === "ar" ? arStrings : undefined;
    return (key: string, vars?: Record<string, string | number>) => {
      const template = table?.[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (_match, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
    };
  }, [lang]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.documentElement.dataset.lang = lang;
    document.body.dir = dir;
  }, [lang, dir]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tr, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be inside LanguageProvider");
  return ctx;
};
