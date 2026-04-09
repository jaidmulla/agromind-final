import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface StatBlockProps {
  label: string;
  value: string | number;
  prefix?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "green" | "red" | "orange" | "blue";
  animate?: boolean;
}

export function StatBlock({
  label,
  value,
  prefix = "",
  trend,
  trendValue,
  color = "green",
  animate = false
}: StatBlockProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[^0-9.-]/g, '')) || 0;

  useEffect(() => {
    if (animate && typeof value === 'number') {
      let start = 0;
      const end = numericValue;
      const duration = 1000;
      const startTime = Date.now();

      const updateValue = () => {
        const now = Date.now();
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.floor(start + (end - start) * eased));

        if (progress < 1) {
          requestAnimationFrame(updateValue);
        }
      };

      requestAnimationFrame(updateValue);
    } else {
      setDisplayValue(numericValue);
    }
  }, [numericValue, animate, value]);

  const colorClasses = {
    green: "text-[#2E7D32] bg-[#E8F5E9]",
    red: "text-[#D32F2F] bg-[#FFEBEE]",
    orange: "text-[#FF6F00] bg-[#FFF3E0]",
    blue: "text-[#1565C0] bg-[#E3F2FD]",
  };

  const trendColors = {
    up: "text-[#2E7D32]",
    down: "text-[#D32F2F]",
    neutral: "text-[#6B7280]",
  };

  return (
    <motion.div
      className="bg-card rounded-xl p-6 border border-border shadow-sm"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
      transition={{ duration: 0.3 }}
    >
      <p className="text-muted-foreground text-sm mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <motion.p
          className={`text-3xl font-bold ${colorClasses[color].split(' ')[0]}`}
          style={{ fontFamily: 'var(--font-mono)', fontFeatureSettings: '"tnum"' }}
        >
          {prefix}{animate ? displayValue.toLocaleString() : value}
        </motion.p>
        {trend && trendValue && (
          <span className={`text-sm ${trendColors[trend]}`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
          </span>
        )}
      </div>
    </motion.div>
  );
}
