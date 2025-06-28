import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  length: number;
  opacity: number;
  color: string;
}

interface ShootingStarsProps {
  width: number;
  height: number;
}

export const ShootingStars: React.FC<ShootingStarsProps> = ({
  width,
  height,
}) => {
  const [stars, setStars] = useState<ShootingStar[]>([]);
  const [nextStarTime, setNextStarTime] = useState<number>(0);
  const animationFrameRef = useRef<number>();

  // Cores possíveis para as estrelas cadentes
  const starColors = [
    "#60A5FA", // Azul
    "#F87171", // Vermelho
    "#34D399", // Verde
    "#FBBF24", // Amarelo
    "#A78BFA", // Roxo
    "#FB7185", // Rosa
    "#FFF", // Branco
  ];

  // Função para criar uma nova estrela cadente
  const createShootingStar = useCallback((): ShootingStar => {
    // Angulos preferenciais (diagonais principalmente)
    const angles = [
      -45,
      -30,
      -60, // Superior direita para inferior esquerda
      45,
      30,
      60, // Superior esquerda para inferior direita
      -135,
      -120,
      -150, // Inferior direita para superior esquerda
      135,
      120,
      150, // Inferior esquerda para superior direita
    ];

    const angle = angles[Math.floor(Math.random() * angles.length)];
    const speed = 2 + Math.random() * 4; // Velocidade entre 2 e 6
    const length = 30 + Math.random() * 80; // Comprimento entre 30 e 110
    const opacity = 0.4 + Math.random() * 0.6; // Opacidade entre 0.4 e 1.0

    // Posição inicial baseada no ângulo
    let startX, startY;

    if (angle >= -60 && angle <= 60) {
      // Vem da esquerda
      startX = -length;
      startY = Math.random() * height;
    } else if (angle >= 60 && angle <= 120) {
      // Vem de cima
      startX = Math.random() * width;
      startY = -length;
    } else if (angle >= 120 || angle <= -120) {
      // Vem da direita
      startX = width + length;
      startY = Math.random() * height;
    } else {
      // Vem de baixo
      startX = Math.random() * width;
      startY = height + length;
    }

    return {
      id: Date.now() + Math.random(),
      x: startX,
      y: startY,
      angle,
      speed,
      length,
      opacity,
      color: starColors[Math.floor(Math.random() * starColors.length)],
    };
  }, [width, height]);

  // Função para calcular próximo tempo de aparição (frequência aumentada para teste)
  const calculateNextStarTime = useCallback(() => {
    // Entre 2 segundos e 8 segundos para teste (2000ms a 8000ms)
    const minDelay = 2000;
    const maxDelay = 8000;
    return Date.now() + minDelay + Math.random() * (maxDelay - minDelay);
  }, []);

  // Inicializar próximo tempo de estrela
  useEffect(() => {
    setNextStarTime(calculateNextStarTime());
  }, [calculateNextStarTime]);

  // Sistema de animação e gerenciamento de estrelas
  useEffect(() => {
    const animate = () => {
      const currentTime = Date.now();

      // Verificar se é hora de criar uma nova estrela
      if (currentTime >= nextStarTime) {
        setStars((prev) => [...prev, createShootingStar()]);
        setNextStarTime(calculateNextStarTime());
      }

      // Atualizar posições das estrelas existentes
      setStars((prev) =>
        prev
          .map((star) => {
            const radians = (star.angle * Math.PI) / 180;
            const newX = star.x + Math.cos(radians) * star.speed;
            const newY = star.y + Math.sin(radians) * star.speed;

            return {
              ...star,
              x: newX,
              y: newY,
            };
          })
          .filter((star) => {
            // Remove estrelas que saíram da tela
            return (
              star.x > -star.length &&
              star.x < width + star.length &&
              star.y > -star.length &&
              star.y < height + star.length
            );
          }),
      );

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [nextStarTime, createShootingStar, calculateNextStarTime, width, height]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {stars.map((star) => {
          const radians = (star.angle * Math.PI) / 180;
          const endX = star.x + Math.cos(radians) * star.length;
          const endY = star.y + Math.sin(radians) * star.length;

          return (
            <motion.div
              key={star.id}
              className="absolute"
              style={{
                left: star.x,
                top: star.y,
                width: star.length,
                height: 2,
                transformOrigin: "0 50%",
                transform: `rotate(${star.angle}deg)`,
                background: `linear-gradient(90deg, ${star.color}00 0%, ${star.color} 50%, ${star.color}00 100%)`,
                boxShadow: `0 0 6px ${star.color}, 0 0 12px ${star.color}40`,
                opacity: star.opacity,
                zIndex: 15,
              }}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{
                opacity: star.opacity,
                scaleX: 1,
                transition: { duration: 0.2 },
              }}
              exit={{
                opacity: 0,
                transition: { duration: 0.3 },
              }}
            >
              {/* Cabeça da estrela cadente - mais brilhante */}
              <div
                className="absolute right-0 top-1/2 transform -translate-y-1/2 rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  background: star.color,
                  boxShadow: `0 0 8px ${star.color}, 0 0 16px ${star.color}60`,
                }}
              />

              {/* Partículas da trilha */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute top-1/2 transform -translate-y-1/2 rounded-full"
                  style={{
                    left: `${20 + i * 25}%`,
                    width: 1 + Math.random(),
                    height: 1 + Math.random(),
                    background: star.color,
                    opacity: 0.3 + Math.random() * 0.4,
                  }}
                  animate={{
                    opacity: [0.3, 0.8, 0.2],
                    scale: [0.5, 1.2, 0.3],
                  }}
                  transition={{
                    duration: 0.5 + Math.random() * 0.5,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
