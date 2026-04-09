import { motion } from "motion/react";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  variant?: "default" | "alert" | "success" | "critical";
  className?: string;
  onClick?: () => void;
}

export function Card({
  children,
  variant = "default",
  className = "",
  onClick
}: CardProps) {
  const baseClasses = "rounded-xl p-6 transition-all duration-300";

  const variantClasses = {
    default: "bg-card border border-border shadow-sm hover:shadow-md",
    alert: "bg-[#FFF3E0] border-2 border-[#FF6F00] shadow-lg",
    success: "bg-[#E8F5E9] border-2 border-[#2E7D32]",
    critical: "bg-[#FFEBEE] border-2 border-[#D32F2F] shadow-xl animate-pulse",
  };

  return (
    <motion.div
      className={`${baseClasses} ${variantClasses[variant]} ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { scale: 1.01, y: -4 } : {}}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
