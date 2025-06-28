import React from "react";
import { motion } from "framer-motion";
import { Globe, Building2, Sparkles, Mountain } from "lucide-react";

interface MapPointData {
  id: string;
  x: number;
  y: number;
  name: string;
  type: "planet" | "station" | "nebula" | "asteroid";
  description: string;
  image?: string;
}

interface MapPointProps {
  point: MapPointData;
  isNearby: boolean;
  onClick: () => void;
  isDragging?: boolean;
  style?: React.CSSProperties;
}

const getPointIcon = (type: string) => {
  switch (type) {
    case "planet":
      return Globe;
    case "station":
      return Building2;
    case "nebula":
      return Sparkles;
    case "asteroid":
      return Mountain;
    default:
      return Globe;
  }
};

const getPointColor = (type: string) => {
  switch (type) {
    case "planet":
      return {
        primary: "#22c55e",
        secondary: "#16a34a",
        glow: "rgb(34, 197, 94)",
      };
    case "station":
      return {
        primary: "#3b82f6",
        secondary: "#1d4ed8",
        glow: "rgb(59, 130, 246)",
      };
    case "nebula":
      return {
        primary: "#8b5cf6",
        secondary: "#7c3aed",
        glow: "rgb(139, 92, 246)",
      };
    case "asteroid":
      return {
        primary: "#f59e0b",
        secondary: "#d97706",
        glow: "rgb(245, 158, 11)",
      };
    default:
      return {
        primary: "#6b7280",
        secondary: "#4b5563",
        glow: "rgb(107, 114, 128)",
      };
  }
};

export const MapPoint: React.FC<MapPointProps> = ({
  point,
  isNearby,
  onClick,
  isDragging = false,
  style,
}) => {
  const Icon = getPointIcon(point.type);
  const colors = getPointColor(point.type);

  return (
    <motion.div
      className={`absolute z-10 ${isDragging ? "pointer-events-none" : "cursor-pointer"}`}
      style={style}
      onClick={onClick}
      whileHover={!isDragging ? { scale: 1.2 } : {}}
      whileTap={!isDragging ? { scale: 0.9 } : {}}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: 1,
        scale: 1,
        filter: isNearby
          ? `drop-shadow(0 0 12px ${colors.glow})`
          : `drop-shadow(0 0 6px ${colors.glow})`,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        delay: Math.random() * 0.5,
      }}
    >
      {/* Outer pulse ring for nearby state */}
      {isNearby && (
        <motion.div
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: colors.primary }}
          animate={{
            scale: [1, 2, 1],
            opacity: [0.8, 0.2, 0.8],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Main point */}
      <motion.div
        className="relative w-6 h-6 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm"
        style={{
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          border: `1px solid ${colors.primary}40`,
        }}
        animate={{
          boxShadow: isNearby
            ? `0 0 20px ${colors.glow}`
            : `0 0 8px ${colors.glow}60`,
        }}
      >
        <Icon size={14} className="text-white drop-shadow-sm" />
      </motion.div>

      {/* Ambient glow */}
      <motion.div
        className="absolute inset-0 rounded-full opacity-30 blur-sm -z-10"
        style={{
          background: `radial-gradient(circle, ${colors.primary}, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: Math.random() * 2,
        }}
      />

      {/* Hover tooltip */}
      <motion.div
        className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-3 py-1 rounded-lg text-xs whitespace-nowrap backdrop-blur-sm border border-white/20 pointer-events-none opacity-0"
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="font-medium">{point.name}</div>
        <div className="text-gray-300 text-xs">{point.description}</div>

        {/* Tooltip arrow */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90" />
      </motion.div>

      {/* Orbit rings for planets */}
      {point.type === "planet" && (
        <motion.div
          className="absolute inset-0 rounded-full border border-white/20 -z-10"
          style={{
            width: "150%",
            height: "150%",
            left: "-25%",
            top: "-25%",
          }}
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      )}
    </motion.div>
  );
};
