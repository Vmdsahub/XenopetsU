import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { PlayerShip } from "./PlayerShip";
import { MapPoint } from "./MapPoint";

interface GalaxyMapProps {
  onPointClick: (pointId: string, pointData: any) => void;
}

interface MapPointData {
  id: string;
  x: number;
  y: number;
  name: string;
  type: "planet" | "station" | "nebula" | "asteroid";
  description: string;
  image?: string;
}

// Configuração simplificada do mundo toroidal
const WORLD_CONFIG = {
  width: 200, // Tamanho do mundo em %
  height: 200,
} as const;

// Função wrap para coordenadas toroidais
const wrap = (value: number, min: number, max: number): number => {
  const range = max - min;
  if (range <= 0) return min;

  let result = value;
  while (result < min) result += range;
  while (result >= max) result -= range;
  return result;
};

const GALAXY_POINTS: MapPointData[] = [
  {
    id: "terra-nova",
    x: 40,
    y: 45,
    name: "Terra Nova",
    type: "planet",
    description: "Um planeta verdejante cheio de vida",
    image:
      "https://images.pexels.com/photos/87651/earth-blue-planet-globe-planet-87651.jpeg",
  },
  {
    id: "estacao-omega",
    x: 60,
    y: 35,
    name: "Estação Omega",
    type: "station",
    description: "Centro comercial da galáxia",
    image: "https://images.pexels.com/photos/2156/sky-earth-space-working.jpg",
  },
  {
    id: "nebulosa-crimson",
    x: 30,
    y: 65,
    name: "Nebulosa Crimson",
    type: "nebula",
    description: "Uma nebulosa misteriosa com energia estranha",
    image: "https://images.pexels.com/photos/1274260/pexels-photo-1274260.jpeg",
  },
  {
    id: "campo-asteroides",
    x: 70,
    y: 55,
    name: "Campo de Asteroides",
    type: "asteroid",
    description: "Rico em recursos minerais raros",
    image:
      "https://images.pexels.com/photos/2159/flight-sky-earth-space-working.jpg",
  },
  {
    id: "mundo-gelado",
    x: 50,
    y: 25,
    name: "Mundo Gelado",
    type: "planet",
    description: "Planeta coberto de gelo eterno",
    image: "https://images.pexels.com/photos/220201/pexels-photo-220201.jpeg",
  },
  // Pontos extras para demonstrar wrap
  {
    id: "estacao-borda",
    x: 95,
    y: 10,
    name: "Estação da Borda",
    type: "station",
    description: "Estação nos limites do espaço",
    image: "https://images.pexels.com/photos/2156/sky-earth-space-working.jpg",
  },
  {
    id: "planeta-limite",
    x: 5,
    y: 90,
    name: "Planeta Limite",
    type: "planet",
    description: "Mundo nos confins da galáxia",
    image:
      "https://images.pexels.com/photos/87651/earth-blue-planet-globe-planet-87651.jpeg",
  },
];

export const GalaxyMap: React.FC<GalaxyMapProps> = ({ onPointClick }) => {
  const [shipPosition, setShipPosition] = useState(() => {
    const saved = localStorage.getItem("xenopets-player-position");
    return saved ? JSON.parse(saved) : { x: 50, y: 50 };
  });

  const [nearbyPoint, setNearbyPoint] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Motion values para posição do mapa (movimento inverso da nave)
  const mapX = useMotionValue(0);
  const mapY = useMotionValue(0);
  const shipRotation = useMotionValue(0);

  // Sistema de rotação suave
  const targetRotation = useRef(0);
  const lastRotationUpdate = useRef(0);

  // Estados para momentum/inércia
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const [isDecelerating, setIsDecelerating] = useState(false);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastMoveTime = useRef(Date.now());
  const [hasMoved, setHasMoved] = useState(false);

  // Canvas ref para estrelas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // Sistema de estrelas simples e efetivo
  const starData = useMemo(() => {
    const colors = [
      "#60A5FA",
      "#F87171",
      "#34D399",
      "#FBBF24",
      "#A78BFA",
      "#FB7185",
    ];

    const createStar = (seed: number, layerType: "bg" | "mid" | "fg") => {
      // Função hash simples e efetiva
      const hash = (n: number) => {
        let h = n * 2654435761;
        h = h ^ (h >> 16);
        h = h * 2654435761;
        h = h ^ (h >> 16);
        return (h >>> 0) / 4294967296;
      };

      const baseConfig = {
        bg: {
          sizeMin: 0.3,
          sizeMax: 0.8,
          opacityMin: 0.1,
          opacityMax: 0.4,
          speed: 0.08,
        },
        mid: {
          sizeMin: 0.6,
          sizeMax: 1.2,
          opacityMin: 0.2,
          opacityMax: 0.6,
          speed: 0.25,
        },
        fg: {
          sizeMin: 1.0,
          sizeMax: 2.0,
          opacityMin: 0.4,
          opacityMax: 0.9,
          speed: 0.5,
        },
      }[layerType];

      return {
        x: hash(seed * 11) * WORLD_CONFIG.width,
        y: hash(seed * 13) * WORLD_CONFIG.height,
        size:
          baseConfig.sizeMin +
          hash(seed * 17) * (baseConfig.sizeMax - baseConfig.sizeMin),
        opacity:
          baseConfig.opacityMin +
          hash(seed * 19) * (baseConfig.opacityMax - baseConfig.opacityMin),
        color:
          layerType === "fg" && hash(seed * 23) > 0.7
            ? colors[Math.floor(hash(seed * 29) * colors.length)]
            : "#ffffff",
        speed: baseConfig.speed,
        isColorful: layerType === "fg" && hash(seed * 23) > 0.7,
      };
    };

    return {
      background: Array.from({ length: 1000 }, (_, i) =>
        createStar(i + 1000, "bg"),
      ),
      middle: Array.from({ length: 500 }, (_, i) =>
        createStar(i + 2000, "mid"),
      ),
      foreground: Array.from({ length: 200 }, (_, i) =>
        createStar(i + 3000, "fg"),
      ),
    };
  }, []);

  // Posição da nave em ref para evitar re-renders
  const shipPosRef = useRef(shipPosition);

  // Atualiza ref quando state muda
  useEffect(() => {
    shipPosRef.current = shipPosition;
  }, [shipPosition]);

  // Geração dinâmica de estrelas baseada na posição da câmera
  const renderStarsCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const currentMapX = mapX.get();
    const currentMapY = mapY.get();

    const colors = [
      "#60A5FA",
      "#F87171",
      "#34D399",
      "#FBBF24",
      "#A78BFA",
      "#FB7185",
    ];

    // Função hash determinística
    const hash = (x: number, y: number, seed: number = 0) => {
      let h = 1779033703 ^ seed;
      h = Math.imul(h ^ x, 3432918353);
      h = (h << 13) | (h >>> 19);
      h = Math.imul(h ^ y, 461845907);
      h = (h << 13) | (h >>> 19);
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };

    // Função para gerar estrelas dinamicamente
    const generateStarsForRegion = (
      centerX: number,
      centerY: number,
      density: number,
      speed: number,
      layerSeed: number,
    ) => {
      const regionSize = 100; // Tamanho da região em pixels
      const regionStartX = Math.floor(centerX / regionSize) * regionSize;
      const regionStartY = Math.floor(centerY / regionSize) * regionSize;

      // Gera estrelas para uma grade 3x3 de regiões ao redor do centro
      for (let rx = -1; rx <= 1; rx++) {
        for (let ry = -1; ry <= 1; ry++) {
          const regX = regionStartX + rx * regionSize;
          const regY = regionStartY + ry * regionSize;

          // Número de estrelas nesta região baseado no hash
          const regionHash = hash(regX, regY, layerSeed);
          const numStars = Math.floor(((regionHash % 100) / 100) * density);

          for (let i = 0; i < numStars; i++) {
            const starHash = hash(regX, regY, layerSeed + i * 1000);

            // Posição dentro da região
            const localX = ((starHash % 10000) / 10000) * regionSize;
            const localY = (((starHash >> 16) % 10000) / 10000) * regionSize;

            const x = regX + localX;
            const y = regY + localY;

            // Propriedades da estrela
            const starHash2 = hash(x, y, layerSeed + 999);
            const size = 0.3 + ((starHash2 % 1000) / 1000) * 1.5;
            const opacity = 0.1 + (((starHash2 >> 10) % 1000) / 1000) * 0.7;
            const isColorful = (starHash2 >> 20) % 100 < 10; // 10% coloridas
            const colorIndex = (starHash2 >> 25) % colors.length;

            // Só renderiza se estiver visível
            if (
              x >= -size &&
              x <= canvasWidth + size &&
              y >= -size &&
              y <= canvasHeight + size
            ) {
              ctx.globalAlpha = opacity;
              const color = isColorful ? colors[colorIndex] : "#ffffff";
              ctx.fillStyle = color;

              if (isColorful) {
                const gradient = ctx.createRadialGradient(
                  x,
                  y,
                  0,
                  x,
                  y,
                  size * 2,
                );
                gradient.addColorStop(0, color);
                gradient.addColorStop(0.5, color + "66");
                gradient.addColorStop(1, color + "00");
                ctx.fillStyle = gradient;

                ctx.beginPath();
                ctx.arc(x, y, size * 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = color;
              }

              ctx.beginPath();
              ctx.arc(x, y, size, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    };

    // Renderiza as camadas com diferentes parallax
    const bgCenterX = canvasWidth / 2 - currentMapX * 0.08;
    const bgCenterY = canvasHeight / 2 - currentMapY * 0.08;
    generateStarsForRegion(bgCenterX, bgCenterY, 15, 0.08, 1000);

    const midCenterX = canvasWidth / 2 - currentMapX * 0.25;
    const midCenterY = canvasHeight / 2 - currentMapY * 0.25;
    generateStarsForRegion(midCenterX, midCenterY, 8, 0.25, 2000);

    const fgCenterX = canvasWidth / 2 - currentMapX * 0.5;
    const fgCenterY = canvasHeight / 2 - currentMapY * 0.5;
    generateStarsForRegion(fgCenterX, fgCenterY, 4, 0.5, 3000);

    ctx.globalAlpha = 1;
  }, [mapX, mapY]);

  // Sistema de animação otimizado para Canvas
  useEffect(() => {
    const animate = () => {
      renderStarsCanvas();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderStarsCanvas]);

  // Atualiza canvas size quando container muda
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    updateCanvasSize();

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Sistema de momentum/inércia
  useEffect(() => {
    velocityRef.current = velocity;
  }, [velocity]);

  // Sistema de rotação suave
  useEffect(() => {
    let animationId: number;

    const smoothRotation = () => {
      const currentAngle = shipRotation.get();
      const target = targetRotation.current;

      // Normaliza ângulos
      let normalizedCurrent = ((currentAngle % 360) + 360) % 360;
      let normalizedTarget = ((target % 360) + 360) % 360;

      // Calcula diferença angular pelo caminho mais curto
      let diff = normalizedTarget - normalizedCurrent;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      // Interpolação suave fixa
      const newAngle = currentAngle + diff * 0.15;

      shipRotation.set(newAngle);

      animationId = requestAnimationFrame(smoothRotation);
    };

    animationId = requestAnimationFrame(smoothRotation);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [shipRotation]);

  // Sistema de momentum mais suave usando interpolação
  useEffect(() => {
    if (
      !isDragging &&
      (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.y) > 0.001)
    ) {
      setIsDecelerating(true);

      let animationId: number;

      const applyMomentum = () => {
        const currentVel = velocityRef.current;
        const friction = 0.995; // Atrito muito suave para deslizamento longo

        // Para quando velocidade fica muito baixa
        if (Math.abs(currentVel.x) < 0.001 && Math.abs(currentVel.y) < 0.001) {
          setIsDecelerating(false);
          setVelocity({ x: 0, y: 0 });
          return;
        }

        const newVelX = currentVel.x * friction;
        const newVelY = currentVel.y * friction;

        // Movimento ainda mais suave para evitar saltos
        const deltaX = newVelX * 1.5; // Movimento mapa reduzido
        const deltaY = newVelY * 1.5;

        // Atualiza posição da nave suavemente
        const newX = wrap(
          shipPosRef.current.x - deltaX / 20, // Divisão maior para movimento mais suave
          0,
          WORLD_CONFIG.width,
        );
        const newY = wrap(
          shipPosRef.current.y - deltaY / 20,
          0,
          WORLD_CONFIG.height,
        );

        setShipPosition({ x: newX, y: newY });

        // Mapa visual move de forma muito suave
        const newMapX = mapX.get() + deltaX;
        const newMapY = mapY.get() + deltaY;

        mapX.set(newMapX);
        mapY.set(newMapY);

        setVelocity({ x: newVelX, y: newVelY });

        animationId = requestAnimationFrame(applyMomentum);
      };

      animationId = requestAnimationFrame(applyMomentum);

      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      };
    }
  }, [isDragging]);

  // Função para calcular distância toroidal correta
  const getToroidalDistance = (
    pos1: { x: number; y: number },
    pos2: { x: number; y: number },
  ) => {
    // Calcula diferenças considerando wrap em mundo toroidal
    const dx1 = Math.abs(pos1.x - pos2.x);
    const dx2 = WORLD_CONFIG.width - dx1;
    const minDx = Math.min(dx1, dx2);

    const dy1 = Math.abs(pos1.y - pos2.y);
    const dy2 = WORLD_CONFIG.height - dy1;
    const minDy = Math.min(dy1, dy2);

    return Math.sqrt(minDx * minDx + minDy * minDy);
  };

  // Verifica proximidade com cálculo de distância toroidal correto
  useEffect(() => {
    const interval = setInterval(() => {
      const threshold = 8;
      let closest: string | null = null;
      let closestDistance = Infinity;

      GALAXY_POINTS.forEach((point) => {
        const distance = getToroidalDistance(shipPosRef.current, point);

        if (distance < threshold && distance < closestDistance) {
          closest = point.id;
          closestDistance = distance;
        }
      });

      setNearbyPoint(closest);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Salva posição - simples
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isDragging) {
        localStorage.setItem(
          "xenopets-player-position",
          JSON.stringify(shipPosRef.current),
        );
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isDragging]);

  // Sistema de mouse nativo mais confiável
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setHasMoved(false);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const currentTime = Date.now();
    const deltaTime = currentTime - lastMoveTime.current;
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;

    // Momentum suavizado baseado no movimento
    if (deltaTime > 0) {
      const velX = Math.max(-1.5, Math.min(1.5, deltaX * 0.08));
      const velY = Math.max(-1.5, Math.min(1.5, deltaY * 0.08));
      setVelocity({ x: velX, y: velY });
    }

    // Atualiza posição da nave de forma mais suave
    const newX = wrap(
      shipPosRef.current.x - deltaX / 12,
      0,
      WORLD_CONFIG.width,
    );
    const newY = wrap(
      shipPosRef.current.y - deltaY / 12,
      0,
      WORLD_CONFIG.height,
    );

    setShipPosition({ x: newX, y: newY });

    // Atualiza mapa visual com wrap
    let newMapX = mapX.get() + deltaX;
    let newMapY = mapY.get() + deltaY;

    // Wrap visual do mapa expandido
    const wrapThreshold = 5000;
    if (newMapX > wrapThreshold) newMapX -= wrapThreshold * 2;
    if (newMapX < -wrapThreshold) newMapX += wrapThreshold * 2;
    if (newMapY > wrapThreshold) newMapY -= wrapThreshold * 2;
    if (newMapY < -wrapThreshold) newMapY += wrapThreshold * 2;

    mapX.set(newMapX);
    mapY.set(newMapY);

    // Rotação responsiva com interpolação suave
    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 1) {
      setHasMoved(true);
      const newAngle = Math.atan2(-deltaY, -deltaX) * (180 / Math.PI) + 90;
      targetRotation.current = newAngle;
      lastRotationUpdate.current = Date.now();
    }

    lastMousePos.current = { x: e.clientX, y: e.clientY };
    lastMoveTime.current = currentTime;
  };

  const handleMouseUp = () => {
    setIsDragging(false);

    // Se não moveu (apenas clique), para completamente
    if (!hasMoved) {
      setVelocity({ x: 0, y: 0 });
      setIsDecelerating(false);
    }

    localStorage.setItem(
      "xenopets-player-position",
      JSON.stringify(shipPosRef.current),
    );
  };

  // Mouse events globais para capturar movimento fora do elemento
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const currentTime = Date.now();
      const deltaTime = currentTime - lastMoveTime.current;
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;

      // Momentum suavizado baseado no movimento
      if (deltaTime > 0) {
        const velX = Math.max(-1.5, Math.min(1.5, deltaX * 0.08));
        const velY = Math.max(-1.5, Math.min(1.5, deltaY * 0.08));
        setVelocity({ x: velX, y: velY });
      }

      const newX = wrap(
        shipPosRef.current.x - deltaX / 12,
        0,
        WORLD_CONFIG.width,
      );
      const newY = wrap(
        shipPosRef.current.y - deltaY / 12,
        0,
        WORLD_CONFIG.height,
      );

      setShipPosition({ x: newX, y: newY });

      // Atualiza mapa visual com wrap
      let newMapX = mapX.get() + deltaX;
      let newMapY = mapY.get() + deltaY;

      // Wrap visual do mapa quando sair muito longe
      const wrapThreshold = 5000; // pixels antes de fazer wrap
      if (newMapX > wrapThreshold) newMapX -= wrapThreshold * 2;
      if (newMapX < -wrapThreshold) newMapX += wrapThreshold * 2;
      if (newMapY > wrapThreshold) newMapY -= wrapThreshold * 2;
      if (newMapY < -wrapThreshold) newMapY += wrapThreshold * 2;

      mapX.set(newMapX);
      mapY.set(newMapY);

      if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 1) {
        setHasMoved(true);
        const newAngle = Math.atan2(-deltaY, -deltaX) * (180 / Math.PI) + 90;
        targetRotation.current = newAngle;
        lastRotationUpdate.current = Date.now();
      }

      lastMousePos.current = { x: e.clientX, y: e.clientY };
      lastMoveTime.current = currentTime;
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);

      // Se não moveu (apenas clique), para completamente
      if (!hasMoved) {
        setVelocity({ x: 0, y: 0 });
        setIsDecelerating(false);
      }

      localStorage.setItem(
        "xenopets-player-position",
        JSON.stringify(shipPosRef.current),
      );
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, mapX, mapY, shipRotation]);

  const resetShipPosition = () => {
    setShipPosition({ x: 50, y: 50 });
    setVelocity({ x: 0, y: 0 });
    setIsDecelerating(false);
    animate(mapX, 0, { duration: 0.5 });
    animate(mapY, 0, { duration: 0.5 });
    animate(shipRotation, 0, { duration: 0.5 });
    localStorage.removeItem("xenopets-player-position");
  };

  const handlePointClick = (pointId: string) => {
    const point = GALAXY_POINTS.find((p) => p.id === pointId);
    if (point) {
      onPointClick(pointId, point);
    }
  };

  // Renderiza pontos de forma otimizada
  const renderPoints = () => {
    return GALAXY_POINTS.map((point) => (
      <div key={point.id} className="pointer-events-auto">
        <MapPoint
          point={point}
          isNearby={nearbyPoint === point.id}
          onClick={() => handlePointClick(point.id)}
          isDragging={isDragging}
          style={{
            left: `${point.x}%`,
            top: `${point.y}%`,
            willChange: "transform", // otimização GPU
          }}
        />
      </div>
    ));
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[650px] bg-gradient-to-br from-gray-950 via-slate-900 to-black rounded-2xl overflow-hidden ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{ userSelect: "none" }}
    >
      {/* Canvas para estrelas com parallax otimizado */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          width: "100%",
          height: "100%",
          willChange: "contents",
        }}
      />

      {/* Nebulosas de fundo */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{
            background: "radial-gradient(circle, #374151, #1f2937)",
            left: "20%",
            top: "30%",
          }}
        />
        <div
          className="absolute w-48 h-48 rounded-full opacity-8 blur-2xl"
          style={{
            background: "radial-gradient(circle, #1f2937, #111827)",
            right: "25%",
            bottom: "20%",
          }}
        />
      </div>

      {/* Área de drag fixa - sempre cobre toda a tela */}
      <div
        className={`absolute inset-0 z-10 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ backgroundColor: "transparent", userSelect: "none" }}
      />

      {/* Mapa visual - movido pelo drag acima */}
      <motion.div
        ref={mapRef}
        className="absolute inset-0 w-[300%] h-[300%] -left-full -top-full pointer-events-none"
        style={{
          x: mapX,
          y: mapY,
          willChange: "transform", // otimização para GPU
        }}
      >
        {/* Renderiza apenas 3 cópias para melhor performance */}
        <div className="absolute inset-0">{renderPoints()}</div>
        <div
          className="absolute inset-0"
          style={{ transform: "translateX(100%)" }}
        >
          {renderPoints()}
        </div>
        <div
          className="absolute inset-0"
          style={{ transform: "translateX(-100%)" }}
        >
          {renderPoints()}
        </div>
      </motion.div>

      {/* Nave do jogador - fixa no centro */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
        <PlayerShip
          rotation={shipRotation}
          isNearPoint={nearbyPoint !== null}
          isDragging={isDragging}
          isDecelerating={isDecelerating}
        />
      </div>

      {/* Coordenadas simplificadas na parte inferior */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/20 text-xs font-mono font-thin">
        X: {mapX.get().toFixed(1)} Y: {mapY.get().toFixed(1)}
      </div>
    </div>
  );
};
