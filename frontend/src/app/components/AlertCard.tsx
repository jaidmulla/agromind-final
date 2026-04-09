import { motion } from "motion/react";
import { AlertCircle, Clock, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "./Button";
import { useMemo } from "react";

interface AlertCardProps {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  loss: number;
  timeLeft: number;
  confidence: number;
  preventable: number;
  onResolve?: () => void;
}

export function AlertCard({
  id,
  title,
  description,
  severity,
  loss,
  timeLeft,
  confidence,
  preventable,
  onResolve
}: AlertCardProps) {
  const navigate = useNavigate();
  const currentLoss = useMemo(() => loss, [loss]);
  const currentTime = useMemo(() => timeLeft, [timeLeft]);

  const severityStyles = {
    critical: {
      card: "bg-[#FFEBEE] border-2 border-[#D32F2F]",
      badge: "bg-[#D32F2F] text-white",
      glow: "shadow-[0_0_20px_rgba(211,47,47,0.3)]",
    },
    warning: {
      card: "bg-[#FFF3E0] border-2 border-[#FF6F00]",
      badge: "bg-[#FF6F00] text-white",
      glow: "shadow-[0_0_15px_rgba(255,111,0,0.2)]",
    },
    info: {
      card: "bg-[#E3F2FD] border border-[#1565C0]",
      badge: "bg-[#1565C0] text-white",
      glow: "",
    },
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <motion.div
      className={`rounded-xl p-6 ${severityStyles[severity].card} ${severityStyles[severity].glow}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: severity === "critical" ? [1, 1.01, 1] : 1,
      }}
      transition={{
        scale: {
          repeat: severity === "critical" ? Infinity : 0,
          duration: 2,
          ease: "easeInOut",
        },
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <AlertCircle className={`w-6 h-6 ${severity === 'critical' ? 'text-[#D32F2F]' : severity === 'warning' ? 'text-[#FF6F00]' : 'text-[#1565C0]'}`} />
          <div>
            <h3 className="font-bold text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${severityStyles[severity].badge}`}>
          {severity.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Potential Loss</p>
          <motion.p
            className="text-xl font-bold text-[#D32F2F]"
            style={{ fontFamily: 'var(--font-mono)' }}
            key={currentLoss}
            initial={{ scale: 1.2, color: "#FF6F00" }}
            animate={{ scale: 1, color: "#D32F2F" }}
            transition={{ duration: 0.3 }}
          >
            ₹{currentLoss.toLocaleString()}
          </motion.p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Time Left</p>
          <p className="text-xl font-bold text-[#FF6F00]" style={{ fontFamily: 'var(--font-mono)' }}>
            <Clock className="w-4 h-4 inline mr-1" />
            {formatTime(currentTime)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">AI Confidence</p>
          <p className="text-xl font-bold text-[#2E7D32]" style={{ fontFamily: 'var(--font-mono)' }}>
            {confidence}%
          </p>
        </div>
      </div>

      <div className="bg-white/50 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-[#2E7D32]" />
          <p className="text-sm font-medium">Prevention Potential</p>
        </div>
        <p className="text-2xl font-bold text-[#2E7D32]" style={{ fontFamily: 'var(--font-mono)' }}>
          ₹{preventable.toLocaleString()}
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          variant="danger"
          className="flex-1"
          onClick={() => navigate(`/solution/${id}`)}
        >
          Take Action Now
        </Button>
        <Button variant="ghost" onClick={onResolve}>
          Dismiss
        </Button>
      </div>
    </motion.div>
  );
}
