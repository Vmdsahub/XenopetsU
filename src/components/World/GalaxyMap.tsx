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

// Gera pontos em círculo ao redor do centro com 40px de espaçamento
const generateCircularPoints = () => {
  const points = [
    {
      id: "terra-nova",
      name: "Terra Nova",
      type: "planet" as const,
      description: "Um planeta verdejante cheio de vida",
      image:
        "https://images.pexels.com/photos/87651/earth-blue-planet-globe-planet-87651.jpeg",
    },
    {
      id: "estacao-omega",
      name: "Estação Omega",
      type: "station" as const,
      description: "Centro comercial da galáxia",
      image:
        "https://images.pexels.com/photos/2156/sky-earth-space-working.jpg",
    },
    {
      id: "nebulosa-crimson",
      name: "Nebulosa Crimson",
      type: "nebula" as const,
      description: "Uma nebulosa misteriosa com energia estranha",
      image:
        "https://images.pexels.com/photos/1274260/pexels-photo-1274260.jpeg",
    },
    {
      id: "campo-asteroides",
      name: "Campo de Asteroides",
      type: "asteroid" as const,
      description: "Rico em recursos minerais raros",
      image:
        "https://images.pexels.com/photos/2159/flight-sky-earth-space-working.jpg",
    },
    {
      id: "mundo-gelado",
      name: "Mundo Gelado",
      type: "planet" as const,
      description: "Planeta coberto de gelo eterno",
      image: "https://images.pexels.com/photos/220201/pexels-photo-220201.jpeg",
    },
    {
      id: "estacao-borda",
      name: "Estação da Borda",
      type: "station" as const,
      description: "Estação nos limites do espaço",
      image:
        "https://images.pexels.com/photos/2156/sky-earth-space-working.jpg",
    },
    {
      id: "planeta-limite",
      name: "Planeta Limite",
      type: "planet" as const,
      description: "Mundo nos confins da galáxia",
      image:
        "https://images.pexels.com/photos/87651/earth-blue-planet-globe-planet-87651.jpeg",
    },
  ];

  const centerX = 50; // Centro do mapa em %
  const centerY = 50;
  const radius = 6; // Raio em % para formar um círculo pequeno

  return points.map((point, index) => {
    const angle = (index / points.length) * 2 * Math.PI;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    return {
      ...point,
      x: Math.max(5, Math.min(95, x)), // Limita entre 5% e 95%
      y: Math.max(5, Math.min(95, y)),
    };
  });
};

const GALAXY_POINTS: MapPointData[] = generateCircularPoints();

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

  // Sistema de estrelas corrigido para escala -5000 a +5000
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

      // Escala real do mapa: -5000 a +5000 = 10000 unidades
      // Expandimos para 20000 unidades para ter estrelas suficientes
      const MAP_SCALE = 20000;

      return {
        x: (hash(seed * 11) - 0.5) * MAP_SCALE,
        y: (hash(seed * 13) - 0.5) * MAP_SCALE,
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
      background: Array.from({ length: 1500 }, (_, i) =>
        createStar(i + 1000, "bg"),
      ),
      middle: Array.from({ length: 800 }, (_, i) =>
        createStar(i + 2000, "mid"),
      ),
      foreground: Array.from({ length: 300 }, (_, i) =>
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

    // Tempo atual para animações
    const currentTime = Date.now() * 0.001; // Converte para segundos

    const colors = [
      "#60A5FA",
      "#F87171",
      "#34D399",
      "#FBBF24",
      "#A78BFA",
      "#FB7185",
    ];

    // Função hash robusta
    const hash = (x: number, y: number, layer: number) => {
      let h = 1779033703 ^ layer;
      h = Math.imul(h ^ Math.floor(x), 3432918353);
      h = (h << 13) | (h >>> 19);
      h = Math.imul(h ^ Math.floor(y), 461845907);
      h = (h << 13) | (h >>> 19);
      return (h >>> 0) / 4294967296;
    };

    // Gera estrelas dinamicamente baseado na região visível
    const generateLayer = (density: number, speed: number, layer: number) => {
      // Calcula posição da câmera com parallax
      const cameraX = -currentMapX * speed;
      const cameraY = -currentMapY * speed;

      // Área visível expandida
      const margin = 200;
      const startX = Math.floor((cameraX - margin) / 50) * 50;
      const endX = Math.ceil((cameraX + canvasWidth + margin) / 50) * 50;
      const startY = Math.floor((cameraY - margin) / 50) * 50;
      const endY = Math.ceil((cameraY + canvasHeight + margin) / 50) * 50;

      // Gera estrelas em grades não-uniformes
      for (let gx = startX; gx < endX; gx += 50) {
        for (let gy = startY; gy < endY; gy += 50) {
          const cellHash = hash(gx, gy, layer);

          // Número de estrelas nesta célula (0-density)
          const numStars = Math.floor(cellHash * density);

          for (let i = 0; i < numStars; i++) {
            const starHash = hash(gx + i * 137, gy + i * 241, layer + i);
            const starHash2 = hash(
              gx + i * 173,
              gy + i * 197,
              layer + i + 1000,
            );

            // Posição dentro da célula (completamente aleatória)
            const localX = starHash * 50;
            const localY = starHash2 * 50;

            const worldX = gx + localX;
            const worldY = gy + localY;

            // Converte para coordenadas do canvas
            const screenX = worldX - cameraX;
            const screenY = worldY - cameraY;

            // Só renderiza se visível
            if (
              screenX >= -10 &&
              screenX <= canvasWidth + 10 &&
              screenY >= -10 &&
              screenY <= canvasHeight + 10
            ) {
              // Propriedades da estrela
              const sizeHash = hash(worldX * 1.1, worldY * 1.3, layer);
              const opacityHash = hash(worldX * 1.7, worldY * 1.9, layer);
              const colorHash = hash(worldX * 2.1, worldY * 2.3, layer);

              // Hash para animações únicas de cada estrela
              const animationSeed = hash(worldX * 3.7, worldY * 4.1, layer);
              const animationSeed2 = hash(worldX * 5.3, worldY * 6.7, layer);

              const baseSize =
                layer === 1
                  ? 0.3 + sizeHash * 0.5
                  : layer === 2
                    ? 0.6 + sizeHash * 0.6
                    : 1.0 + sizeHash * 1.0;

              const baseOpacity =
                layer === 1
                  ? 0.1 + opacityHash * 0.3
                  : layer === 2
                    ? 0.2 + opacityHash * 0.4
                    : 0.4 + opacityHash * 0.5;

              // Animação de piscar - diferentes frequências para cada estrela
              const blinkSpeed = 0.5 + animationSeed * 1.5; // Velocidade entre 0.5 e 2.0
              const blinkPhase = animationSeed * Math.PI * 2; // Fase inicial aleatória
              const blinkIntensity = 0.3 + animationSeed2 * 0.4; // Intensidade entre 0.3 e 0.7
              const blinkFactor =
                1 +
                Math.sin(currentTime * blinkSpeed + blinkPhase) *
                  blinkIntensity;

              // Animação de movimento flutuante
              const floatSpeedX = (animationSeed - 0.5) * 0.8; // Velocidade entre -0.4 e 0.4
              const floatSpeedY = (animationSeed2 - 0.5) * 0.6; // Velocidade entre -0.3 e 0.3
              const floatPhaseX = animationSeed * Math.PI * 4;
              const floatPhaseY = animationSeed2 * Math.PI * 4;
              const floatRange = layer === 1 ? 0.3 : layer === 2 ? 0.5 : 0.8; // Movimento maior para estrelas maiores

              const floatOffsetX =
                Math.sin(currentTime * floatSpeedX + floatPhaseX) * floatRange;
              const floatOffsetY =
                Math.cos(currentTime * floatSpeedY + floatPhaseY) * floatRange;

              const animatedSize = baseSize * blinkFactor;
              const animatedOpacity = Math.min(1, baseOpacity * blinkFactor);
              const animatedX = screenX + floatOffsetX;
              const animatedY = screenY + floatOffsetY;

              const isColorful = layer === 3 && colorHash > 0.8;
              const color = isColorful
                ? colors[Math.floor(colorHash * colors.length)]
                : "#ffffff";

              ctx.globalAlpha = animatedOpacity;
              ctx.fillStyle = color;

              if (isColorful) {
                const gradient = ctx.createRadialGradient(
                  animatedX,
                  animatedY,
                  0,
                  animatedX,
                  animatedY,
                  animatedSize * 2.5,
                );
                gradient.addColorStop(0, color);
                gradient.addColorStop(0.4, color + "77");
                gradient.addColorStop(1, color + "00");
                ctx.fillStyle = gradient;

                ctx.beginPath();
                ctx.arc(
                  animatedX,
                  animatedY,
                  animatedSize * 2.5,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();

                ctx.fillStyle = color;
              }

              ctx.beginPath();
              ctx.arc(animatedX, animatedY, animatedSize, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    };

    // Renderiza camadas
    generateLayer(8, 0.08, 1); // Background
    generateLayer(4, 0.25, 2); // Middle
    generateLayer(2, 0.5, 3); // Foreground

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

        // Calcula nova posição proposta para momentum
        const proposedX = wrap(
          shipPosRef.current.x - deltaX / 20, // Divisão maior para movimento mais suave
          0,
          WORLD_CONFIG.width,
        );
        const proposedY = wrap(
          shipPosRef.current.y - deltaY / 20,
          0,
          WORLD_CONFIG.height,
        );

        // Verifica colisão com barreira circular no momentum usando coordenadas visuais
        let newX = proposedX;
        let newY = proposedY;

        const canvas = canvasRef.current;
        if (canvas) {
          const centerVisualX = canvas.width / 2;
          const centerVisualY = canvas.height / 2;

          const currentMapX = mapX.get();
          const currentMapY = mapY.get();
          const deltaMapX = (shipPosRef.current.x - proposedX) * 12;
          const deltaMapY = (shipPosRef.current.y - proposedY) * 12;
          const proposedMapX = currentMapX + deltaMapX;
          const proposedMapY = currentMapY + deltaMapY;

          const effectiveShipX = centerVisualX - proposedMapX;
          const effectiveShipY = centerVisualY - proposedMapY;

          const barrierRadius = 1200; // 2400px de diâmetro = 1200px de raio
          const distanceFromCenter = Math.sqrt(
            Math.pow(effectiveShipX - centerVisualX, 2) +
              Math.pow(effectiveShipY - centerVisualY, 2),
          );

          if (distanceFromCenter > barrierRadius) {
            // Para o momentum completamente e mantém posição atual
            setIsDecelerating(false);
            setVelocity({ x: 0, y: 0 });
            return;
          }
        }

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

    // Calcula nova posição proposta
    const proposedX = wrap(
      shipPosRef.current.x - deltaX / 12,
      0,
      WORLD_CONFIG.width,
    );
    const proposedY = wrap(
      shipPosRef.current.y - deltaY / 12,
      0,
      WORLD_CONFIG.height,
    );

    // Verifica colisão com barreira circular usando coordenadas visuais
    let newX = proposedX;
    let newY = proposedY;
    let allowMovement = true;

    const canvas = canvasRef.current;
    if (canvas) {
      // Converte posição da nave para coordenadas visuais
      const centerVisualX = canvas.width / 2;
      const centerVisualY = canvas.height / 2;

      // Calcula posição visual proposta baseada no movimento do mapa
      const currentMapX = mapX.get();
      const currentMapY = mapY.get();
      const deltaMapX = (shipPosRef.current.x - proposedX) * 12; // Inverte o cálculo do movimento
      const deltaMapY = (shipPosRef.current.y - proposedY) * 12;
      const proposedMapX = currentMapX + deltaMapX;
      const proposedMapY = currentMapY + deltaMapY;

      // A posição efetiva da nave em relação ao centro é o inverso do movimento do mapa
      const effectiveShipX = centerVisualX - proposedMapX;
      const effectiveShipY = centerVisualY - proposedMapY;

      const barrierRadius = 1200; // 2400px de diâmetro = 1200px de raio (2x maior)
      const distanceFromCenter = Math.sqrt(
        Math.pow(effectiveShipX - centerVisualX, 2) +
          Math.pow(effectiveShipY - centerVisualY, 2),
      );

      // Se ultrapassar a barreira, bloqueia completamente
      if (distanceFromCenter > barrierRadius) {
        // Não permite o movimento - mantém posição atual
        newX = shipPosRef.current.x;
        newY = shipPosRef.current.y;
        allowMovement = false;

        // Para todo movimento
        setVelocity({ x: 0, y: 0 });
        setIsDecelerating(false);
      }
    }

    setShipPosition({ x: newX, y: newY });

    // Só atualiza mapa visual se movimento é permitido
    if (allowMovement) {
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
    }

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

      // Calcula nova posição proposta
      const proposedX = wrap(
        shipPosRef.current.x - deltaX / 12,
        0,
        WORLD_CONFIG.width,
      );
      const proposedY = wrap(
        shipPosRef.current.y - deltaY / 12,
        0,
        WORLD_CONFIG.height,
      );

      // Verifica colisão com barreira circular usando coordenadas visuais
      let newX = proposedX;
      let newY = proposedY;
      let allowMovement = true;

      const canvas = canvasRef.current;
      if (canvas) {
        const centerVisualX = canvas.width / 2;
        const centerVisualY = canvas.height / 2;

        const currentMapX = mapX.get();
        const currentMapY = mapY.get();
        const deltaMapX = (shipPosRef.current.x - proposedX) * 12;
        const deltaMapY = (shipPosRef.current.y - proposedY) * 12;
        const proposedMapX = currentMapX + deltaMapX;
        const proposedMapY = currentMapY + deltaMapY;

        const effectiveShipX = centerVisualX - proposedMapX;
        const effectiveShipY = centerVisualY - proposedMapY;

        const barrierRadius = 1200; // 2400px de diâmetro = 1200px de raio
        const distanceFromCenter = Math.sqrt(
          Math.pow(effectiveShipX - centerVisualX, 2) +
            Math.pow(effectiveShipY - centerVisualY, 2),
        );

        if (distanceFromCenter > barrierRadius) {
          // Não permite o movimento - mantém posição atual
          newX = shipPosRef.current.x;
          newY = shipPosRef.current.y;
          allowMovement = false;

          setVelocity({ x: 0, y: 0 });
          setIsDecelerating(false);
        }
      }

      setShipPosition({ x: newX, y: newY });

      // Só atualiza mapa visual se movimento é permitido
      if (allowMovement) {
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
      }

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
        /* Barreira circular fixa no centro do mapa */
        <div
          className="absolute pointer-events-none"
          style={{
            left: "50%", // Centro do mundo (100% = WORLD_CONFIG.width)
            top: "50%", // Centro do mundo (100% = WORLD_CONFIG.height)
            width: "2400px", // Diâmetro 2400px = 1200px de raio (2x maior)
            height: "2400px",
            transform: "translate(-50%, -50%)",
            border: "2px dashed rgba(255, 255, 255, 0.15)",
            borderRadius: "50%",
            zIndex: 5,
          }}
        />
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
