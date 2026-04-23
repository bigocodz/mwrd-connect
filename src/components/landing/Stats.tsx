import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const AnimatedNumber = ({ value, inView }: { value: string; inView: boolean }) => {
  const numMatch = value.match(/(\d+)/);
  const target = numMatch ? parseInt(numMatch[1]) : 0;
  const prefix = numMatch ? value.slice(0, value.indexOf(numMatch[1])) : "";
  const suffix = numMatch ? value.slice(value.indexOf(numMatch[1]) + numMatch[1].length) : "";
  const hasNum = !!numMatch;

  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (inView && hasNum) {
      const controls = animate(motionVal, target, { duration: 2, ease: "easeOut" });
      return controls.stop;
    }
  }, [inView, target, motionVal, hasNum]);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return unsub;
  }, [rounded]);

  if (!hasNum) return <span>{value}</span>;

  return (
    <span>
      {prefix}{display}{suffix}
    </span>
  );
};

const Stats = () => {
  const { t } = useLanguage();
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.h2
          className="font-display text-2xl sm:text-3xl font-extrabold text-foreground text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {t.stats.title}
        </motion.h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-3xl mx-auto text-center">
          {t.stats.items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="font-display text-3xl sm:text-4xl font-extrabold text-accent">
                <AnimatedNumber value={item.value} inView={inView} />
              </div>
              <p className="text-muted-foreground text-sm mt-1">{item.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
