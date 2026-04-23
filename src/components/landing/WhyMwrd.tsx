import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Settings2, ShieldCheck, Activity, Headphones } from "lucide-react";

const icons = [Settings2, ShieldCheck, Activity, Headphones];

const WhyMwrd = () => {
  const { t } = useLanguage();

  return (
    <section className="py-24 bg-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")"
      }} />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-primary-foreground mb-4">
            {t.whyMwrd.title}
          </h2>
          <p className="text-primary-foreground/60 text-lg max-w-xl mx-auto">
            {t.whyMwrd.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {t.whyMwrd.items.map((item, i) => {
            const Icon = icons[i];
            return (
              <motion.div
                key={i}
                className="group bg-primary-foreground/5 border border-primary-foreground/10 rounded-2xl p-8 backdrop-blur-sm hover:bg-primary-foreground/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-default"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent/30 transition-colors">
                  <Icon className="w-6 h-6 text-sky" />
                </div>
                <h3 className="font-display text-lg font-bold text-primary-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-primary-foreground/60 leading-relaxed text-sm">
                  {item.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyMwrd;
