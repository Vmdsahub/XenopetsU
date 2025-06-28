import React, { useEffect, useState } from "react";
import { motion, MotionValue } from "framer-motion";
import { startEngineSound, stopEngineSound } from "../../utils/soundManager";

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
  const [showTrail, setShowTrail] = useState(false);

  useEffect(() => {
    if (isDragging) {
      setShowTrail(true);
      // Inicia o som quando começa a arrastar - o debounce interno cuida da frequência
      startEngineSound();
    } else {
      // Para o som quando para de arrastar - com debounce interno
      stopEngineSound();

      // Mantém o trail por um tempo após parar
      const timeout = setTimeout(() => {
        setShowTrail(false);
      }, 150);

      return () => clearTimeout(timeout);
    }
  }, [isDragging]);

  return (
    <motion.div
      className={`relative w-10 h-10 z-20 ${isDragging ? "pointer-events-none" : ""}`}
      style={{ rotate: rotation }}
      animate={{
        scale: isDragging ? 1.1 : 1,
        // Vibração quando dragging (motor ligado) ou flutuação quando parado
        y: isDragging ? [0, -0.5, 0, 0.5, 0] : [0, -2, 0, 2, 0],
        x: isDragging ? [0, 0.5, 0, -0.5, 0] : [0, 1.5, 0, -1.5, 0],
      }}
      transition={{
        scale: { type: "spring", stiffness: 300, damping: 30 },
        y: {
          duration: isDragging ? 0.15 : 2.2,
          repeat: Infinity,
          ease: isDragging ? "linear" : "easeInOut",
        },
        x: {
          duration: isDragging ? 0.12 : 2.8,
          repeat: Infinity,
          ease: isDragging ? "linear" : "easeInOut",
        },
      }}
    >
      {/* Spaceship Image */}
      <motion.img
        src="https://cdn.builder.io/api/v1/image/assets%2F4d288afc418148aaaf0f73eedbc53e2b%2F01991177d397420f9f7b55d6a6283724?format=webp&width=800"
        alt="Spaceship"
        className="w-full h-full object-contain drop-shadow-lg"
      />

      {/* Ship trails - apenas quando arrastando */}
      {showTrail && (
        <>
          <motion.div
            className="absolute w-0.5 h-6 bg-gradient-to-t from-transparent to-blue-400 transform -translate-x-1/2"
            style={{
              top: "calc(100% - 12px)",
              left: "calc(50% - 1px)",
              zIndex: -1,
            }}
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
            className="absolute w-0.5 h-5 bg-gradient-to-t from-transparent to-cyan-300 transform -translate-x-1/2"
            style={{
              top: "calc(100% - 8px)",
              left: "calc(50% - 1px)",
              zIndex: -1,
            }}
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
