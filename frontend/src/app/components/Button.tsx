import { motion } from "motion/react";
import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "danger" | "ghost";
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function Button({
  children,
  variant = "primary",
  onClick,
  className = "",
  disabled = false
}: ButtonProps) {
  const baseClasses = "px-6 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    primary: "bg-[#2E7D32] text-white hover:bg-[#1B5E20] shadow-sm hover:shadow-md",
    danger: "bg-[#D32F2F] text-white hover:bg-[#B71C1C] shadow-sm hover:shadow-md",
    ghost: "bg-transparent text-[#2E7D32] hover:bg-[#F7F8F6] border border-[#2E7D32]",
  };

  return (
    <motion.button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02, y: -2 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
    >
      {children}
    </motion.button>
  );
}
