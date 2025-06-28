import React from "react";
import { motion, MotionValue } from "framer-motion";

interface PlayerShipProps {
  rotation: MotionValue<number>;
  isNearPoint: boolean;
  isDragging: boolean;
  isDecelerating?: boolean;
}

export const PlayerShip: React.FC<PlayerShipProps> = ({
  rotation,
  isNearPoint,
  isDragging,
  isDecelerating = false,
}) => {
  return (
    <motion.div
      className={`relative w-10 h-10 z-20 ${isDragging ? "pointer-events-none" : ""}`}
      style={{ rotate: rotation }}
      animate={{
        scale: isDragging ? 1.1 : 1,
        // Flutuação sutil indicando que está ligada
        y: isDragging ? 0 : [0, -2, 0, 2, 0],
        x: isDragging ? 0 : [0, 1.5, 0, -1.5, 0],
      }}
      transition={{
        scale: { type: "spring", stiffness: 300, damping: 30 },
        y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
        x: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      {/* Spaceship Image */}
      <motion.img
        src="https://cdn.builder.io/api/v1/image/assets%2F4d288afc418148aaaf0f73eedbc53e2b%2F01991177d397420f9f7b55d6a6283724?format=webp&width=800"
        alt="Spaceship"
        className="w-full h-full object-contain drop-shadow-lg"
      />

      {/* Ship trails - apenas quando arrastando */}
      {isDragging && (
        <>
          <motion.div
            className="absolute left-1/2 w-0.5 h-4 bg-gradient-to-t from-transparent to-blue-400 transform -translate-x-1/2"
            style={{ top: "calc(100% - 6px)" }}
            animate={{
              opacity: [0.3, 0.8, 0.3],
              scaleY: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute left-1/2 w-0.5 h-3 bg-gradient-to-t from-transparent to-cyan-300 transform -translate-x-1/2"
            style={{ top: "calc(100% - 2px)" }}
            animate={{
              opacity: [0.2, 0.6, 0.2],
              scaleY: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 0.3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.1,
            }}
          />
        </>
      )}
    </motion.div>
  );
};
