import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const HowItWorks = () => {
  const { t } = useLanguage();

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 start-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 end-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-4">
            {t.howItWorks.title}
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {t.howItWorks.subtitle}
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto relative">
          {/* Connecting line */}
          <div className="absolute start-8 sm:start-1/2 top-0 bottom-0 w-px bg-border hidden sm:block" />

          {t.howItWorks.steps.map((step, i) => (
            <motion.div
              key={i}
              className={`flex items-start gap-8 mb-16 last:mb-0 ${
                i % 2 === 1 ? "sm:flex-row-reverse" : ""
              }`}
              initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
            >
              <div className="flex-1 text-center sm:text-start">
                <div
                  className={`${
                    i % 2 === 1 ? "sm:text-start" : "sm:text-end"
                  }`}
                >
                  <span className="font-display text-5xl sm:text-6xl font-extrabold text-accent/20">
                    {step.number}
                  </span>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground mt-2 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto sm:mx-0 sm:ms-auto">
                    {step.desc}
                  </p>
                </div>
              </div>

              {/* Center dot */}
              <div className="hidden sm:flex flex-shrink-0 w-4 h-4 rounded-full bg-accent border-4 border-background shadow-lg mt-8 relative z-10" />

              <div className="flex-1 hidden sm:block" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
