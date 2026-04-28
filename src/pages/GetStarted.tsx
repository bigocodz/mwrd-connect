import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";

type AccountType = "CLIENT" | "SUPPLIER";

type FormState = {
  full_name: string;
  company_name: string;
  cr_number: string;
  vat_number: string;
  email: string;
  phone: string;
  account_type: AccountType;
  notes: string;
};

const initialForm: FormState = {
  full_name: "",
  company_name: "",
  cr_number: "",
  vat_number: "",
  email: "",
  phone: "",
  account_type: "CLIENT",
  notes: "",
};

const getLeadEndpoint = () => {
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
  if (siteUrl) return `${siteUrl.replace(/\/$/, "")}/submit-lead`;
  return "/submit-lead";
};

const GetStarted = () => {
  const { t, tr, lang, setLang, dir } = useLanguage();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const leadEndpoint = useMemo(getLeadEndpoint, []);

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch(leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          company_name: form.company_name.trim() || undefined,
          cr_number: form.cr_number.trim() || undefined,
          vat_number: form.vat_number.trim() || undefined,
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          account_type: form.account_type,
          notes: form.notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || t.getStarted.errorMsg);
      }

      setSubmitted(true);
      setForm(initialForm);
      toast.success(t.getStarted.thankTitle);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.getStarted.errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#1a1a1a]" dir={dir}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center">
          <img src="/logos/asset-2.svg" alt="MWRD" className="h-9 w-auto max-w-[132px]" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-[#5f625f] transition-colors hover:bg-[#eef7f8] hover:text-[#1a1a1a]"
            aria-label={tr("Toggle language")}
          >
            <Languages className="h-4 w-4" />
            {lang === "en" ? "عربي" : "EN"}
          </button>
          <Button asChild variant="nav-outline" size="sm">
            <Link to="/login">{t.nav.login}</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-10 pt-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pb-16 lg:pt-10">
        <section className="flex flex-col justify-center">
          <div className="mb-8 h-1 w-12 rounded-full bg-[#ff6d43]" />
          <p className="text-sm font-semibold uppercase tracking-normal text-[#ff6d43]">
            {t.hero.badge}
          </p>
          <h1 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-tight tracking-normal text-[#1a1a1a] sm:text-5xl">
            {t.getStarted.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#5f625f]">
            {t.getStarted.desc}
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {t.howItWorks.steps.map((step) => (
              <div key={step.number} className="rounded-lg bg-white p-4 shadow-[inset_0_0_0_1px_rgba(228,231,236,1)]">
                <p className="text-xs font-semibold text-[#ff6d43]">{step.number}</p>
                <p className="mt-2 text-sm font-semibold text-[#1d2939]">{step.title}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="overflow-hidden rounded-xl border-[#e4e7ec] bg-white shadow-sm">
          <CardContent className="p-6 sm:p-8">
            {submitted ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f8f2] text-[#246b55]">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h2 className="mt-5 font-display text-3xl font-semibold text-[#1a1a1a]">
                  {t.getStarted.thankTitle}
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-[#5f625f]">
                  {t.getStarted.thankDesc}
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button asChild>
                    <Link to="/login">{t.nav.login}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/">{t.getStarted.backHome}</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">{t.getStarted.fullName}</Label>
                    <Input
                      id="full_name"
                      value={form.full_name}
                      onChange={(event) => update("full_name", event.target.value)}
                      placeholder={t.getStarted.fullNamePh}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_name">{t.getStarted.company}</Label>
                    <Input
                      id="company_name"
                      value={form.company_name}
                      onChange={(event) => update("company_name", event.target.value)}
                      placeholder={t.getStarted.companyPh}
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t.getStarted.email}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => update("email", event.target.value)}
                      placeholder={t.getStarted.emailPh}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t.getStarted.phone}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(event) => update("phone", event.target.value)}
                      placeholder={t.getStarted.phonePh}
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cr_number">{t.getStarted.crNumber}</Label>
                    <Input
                      id="cr_number"
                      value={form.cr_number}
                      onChange={(event) => update("cr_number", event.target.value)}
                      placeholder={t.getStarted.crNumberPh}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vat_number">{t.getStarted.vatNumber}</Label>
                    <Input
                      id="vat_number"
                      value={form.vat_number}
                      onChange={(event) => update("vat_number", event.target.value)}
                      placeholder={t.getStarted.vatNumberPh}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t.getStarted.accountType}</Label>
                  <Select value={form.account_type} onValueChange={(value: AccountType) => update("account_type", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLIENT">{t.getStarted.roleClient}</SelectItem>
                      <SelectItem value="SUPPLIER">{t.getStarted.roleSupplier}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t.getStarted.message}</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(event) => update("notes", event.target.value)}
                    placeholder={t.getStarted.messagePh}
                    className="min-h-28"
                  />
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#5f625f] hover:text-[#1a1a1a]">
                    {dir === "rtl" ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                    {t.getStarted.backHome}
                  </Link>
                  <Button type="submit" disabled={submitting} className="h-11 min-w-40">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.getStarted.submitting}
                      </>
                    ) : (
                      <>
                        {t.getStarted.submit}
                        {dir === "rtl" ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default GetStarted;
