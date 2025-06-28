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

  // Estrelas fixas - distribuídas em todo o mapa toroidal
  const stars = useMemo(() => {
    return Array.from({ length: 1200 }, (_, i) => ({
      id: i,
      x: Math.random() * WORLD_CONFIG.width, // Cobre todo o mundo toroidal
      y: Math.random() * WORLD_CONFIG.height,
      animationDelay: Math.random() * 3,
      animationDuration: 2 + Math.random() * 2,
      size: 0.5 + Math.random() * 1.5, // Tamanhos variados
      layer: Math.floor(Math.random() * 3), // 3 camadas para parallax
    }));
  }, []);

  // Posição da nave em ref para evitar re-renders
  const shipPosRef = useRef(shipPosition);

  // Atualiza ref quando state muda
  useEffect(() => {
    shipPosRef.current = shipPosition;
  }, [shipPosition]);

  // Atualiza parallax das estrelas em tempo real
  useEffect(() => {
    const updateParallax = () => {
      const layer1 = document.querySelectorAll('[data-star-layer="0"]');
      const layer2 = document.querySelectorAll('[data-star-layer="1"]');
      const layer3 = document.querySelectorAll('[data-star-layer="2"]');

      const mapXValue = mapX.get();
      const mapYValue = mapY.get();

      layer1.forEach((el: any) => {
        el.style.transform = `translate(${mapXValue * 0.1}px, ${mapYValue * 0.1}px)`;
      });

      layer2.forEach((el: any) => {
        el.style.transform = `translate(${mapXValue * 0.3}px, ${mapYValue * 0.3}px)`;
      });

      layer3.forEach((el: any) => {
        el.style.transform = `translate(${mapXValue * 0.6}px, ${mapYValue * 0.6}px)`;
      });

      requestAnimationFrame(updateParallax);
    };

    updateParallax();
  }, [mapX, mapY]);

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

        // Movimento muito suave - dividindo por valores maiores
        const deltaX = newVelX * 2; // Movimento mapa
        const deltaY = newVelY * 2;

        // Atualiza posição da nave suavemente
        const newX = wrap(
          shipPosRef.current.x - deltaX / 16,
          0,
          WORLD_CONFIG.width,
        );
        const newY = wrap(
          shipPosRef.current.y - deltaY / 16,
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

  // Verifica proximidade - simples e direto
  useEffect(() => {
    const interval = setInterval(() => {
      const threshold = 8;
      let closest: string | null = null;
      let closestDistance = Infinity;

      GALAXY_POINTS.forEach((point) => {
        const dx = Math.abs(shipPosRef.current.x - point.x);
        const dy = Math.abs(shipPosRef.current.y - point.y);
        const distance = Math.sqrt(dx * dx + dy * dy);

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

    // Calcula velocidade para momentum - suave mas responsiva
    if (deltaTime > 0) {
      const velX = deltaX * 0.2; // Velocidade baseada diretamente no movimento
      const velY = deltaY * 0.2;
      setVelocity({ x: velX, y: velY });
    }

    // Atualiza posição da nave
    const newX = wrap(shipPosRef.current.x - deltaX / 8, 0, WORLD_CONFIG.width);
    const newY = wrap(
      shipPosRef.current.y - deltaY / 8,
      0,
      WORLD_CONFIG.height,
    );

    setShipPosition({ x: newX, y: newY });

    // Atualiza mapa visual com wrap
    let newMapX = mapX.get() + deltaX;
    let newMapY = mapY.get() + deltaY;

    // Wrap visual do mapa
    const wrapThreshold = 2000;
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

      // Calcula velocidade para momentum - suave mas responsiva
      if (deltaTime > 0) {
        const velX = deltaX * 0.2;
        const velY = deltaY * 0.2;
        setVelocity({ x: velX, y: velY });
      }

      const newX = wrap(
        shipPosRef.current.x - deltaX / 8,
        0,
        WORLD_CONFIG.width,
      );
      const newY = wrap(
        shipPosRef.current.y - deltaY / 8,
        0,
        WORLD_CONFIG.height,
      );

      setShipPosition({ x: newX, y: newY });

      // Atualiza mapa visual com wrap
      let newMapX = mapX.get() + deltaX;
      let newMapY = mapY.get() + deltaY;

      // Wrap visual do mapa quando sair muito longe
      const wrapThreshold = 2000; // pixels antes de fazer wrap
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
      {/* Camada 1 - Estrelas distantes (parallax lento) */}
      <div
        className="absolute inset-0 w-[300%] h-[300%] -left-full -top-full opacity-60 pointer-events-none overflow-hidden"
        data-star-layer="0"
      >
        {stars
          .filter((star) => star.layer === 0)
          .map((star) => (
            <div
              key={`layer0-${star.id}`}
              className="absolute bg-white rounded-full"
              style={{
                left: `${(star.x / WORLD_CONFIG.width) * 100}%`,
                top: `${(star.y / WORLD_CONFIG.height) * 100}%`,
                width: `${star.size * 0.8}px`,
                height: `${star.size * 0.8}px`,
                animation: `twinkle ${star.animationDuration}s ease-in-out ${star.animationDelay}s infinite alternate`,
              }}
            />
          ))}
      </div>

      {/* Camada 2 - Estrelas médias (parallax médio) */}
      <div
        className="absolute inset-0 w-[300%] h-[300%] -left-full -top-full opacity-75 pointer-events-none overflow-hidden"
        data-star-layer="1"
      >
        {stars
          .filter((star) => star.layer === 1)
          .map((star) => (
            <div
              key={`layer1-${star.id}`}
              className="absolute bg-cyan-100 rounded-full"
              style={{
                left: `${(star.x / WORLD_CONFIG.width) * 100}%`,
                top: `${(star.y / WORLD_CONFIG.height) * 100}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                animation: `twinkle ${star.animationDuration}s ease-in-out ${star.animationDelay}s infinite alternate`,
              }}
            />
          ))}
      </div>

      {/* Camada 3 - Estrelas próximas (parallax rápido) */}
      <div
        className="absolute inset-0 w-[300%] h-[300%] -left-full -top-full opacity-90 pointer-events-none overflow-hidden"
        data-star-layer="2"
      >
        {stars
          .filter((star) => star.layer === 2)
          .map((star) => (
            <div
              key={`layer2-${star.id}`}
              className="absolute bg-blue-100 rounded-full"
              style={{
                left: `${(star.x / WORLD_CONFIG.width) * 100}%`,
                top: `${(star.y / WORLD_CONFIG.height) * 100}%`,
                width: `${star.size * 1.2}px`,
                height: `${star.size * 1.2}px`,
                animation: `twinkle ${star.animationDuration}s ease-in-out ${star.animationDelay}s infinite alternate`,
              }}
            />
          ))}
      </div>

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

      {/* Indicador de status */}
      <motion.div
        className="absolute top-4 left-4 px-3 py-1 rounded-lg text-xs backdrop-blur-sm border bg-black/70 text-cyan-300 border-cyan-400/40"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        🌌 Mundo Toroidal
      </motion.div>

      {/* Coordenadas */}
      <motion.div
        className="absolute top-12 left-4 px-3 py-1 rounded-lg text-xs backdrop-blur-sm border bg-black/70 text-gray-300 border-gray-400/40"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        X: {Math.round(shipPosition.x)} Y: {Math.round(shipPosition.y)}
      </motion.div>

      {/* Ponto próximo */}
      {nearbyPoint && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm border border-green-400/30 pointer-events-none"
        >
          <div className="text-green-400 font-medium">
            {GALAXY_POINTS.find((p) => p.id === nearbyPoint)?.name}
          </div>
          <div className="text-xs text-gray-300">Clique para explorar</div>
        </motion.div>
      )}

      {/* Botão reset */}
      <button
        onClick={resetShipPosition}
        className="absolute top-4 right-4 text-white/90 text-xs bg-red-600/80 hover:bg-red-600/90 px-3 py-2 rounded-lg backdrop-blur-sm transition-all duration-200 border border-red-400/30"
        title="Voltar ao centro"
      >
        🏠 Centro
      </button>

      {/* Dica */}
      <div className="absolute top-4 right-24 text-white/60 text-xs bg-black/50 px-3 py-2 rounded-lg backdrop-blur-sm border border-white/20">
        Arraste • Mundo infinito
      </div>
    </div>
  );
};
