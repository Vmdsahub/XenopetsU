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
import { playBarrierCollisionSound } from "../../utils/soundManager";

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
  const [isColliding, setIsColliding] = useState(false);
  const [sparks, setSparks] = useState<
    Array<{ id: number; x: number; y: number; dx: number; dy: number }>
  >([]);
  const [collisionNotification, setCollisionNotification] = useState<{
    show: boolean;
    id: number;
  }>({ show: false, id: 0 });

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

  // Sistema de estrelas com mais densidade e parallax forte
  const starData = useMemo(() => {
    // Cores realistas de estrelas baseadas na temperatura
    const starColors = [
      "#ffffff", // Branco (maioria)
      "#fffacd", // Branco-amarelado
      "#ffd700", // Amarelo
      "#ffb347", // Laranja
      "#ff6b47", // Vermelho
      "#87ceeb", // Azul claro
      "#4169e1", // Azul
    ];

    const createStar = (seed: number, layerType: "bg" | "mid" | "fg") => {
      // Função hash simples
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
          opacityMin: 0.4,
          opacityMax: 0.8,
          speed: 0.1, // Parallax mais forte
        },
        mid: {
          sizeMin: 0.5,
          sizeMax: 1.2,
          opacityMin: 0.5,
          opacityMax: 0.9,
          speed: 0.3, // Parallax mais forte
        },
        fg: {
          sizeMin: 0.8,
          sizeMax: 1.8,
          opacityMin: 0.7,
          opacityMax: 1.0,
          speed: 0.6, // Parallax mais forte
        },
      }[layerType];

      const MAP_SCALE = 18000; // Área maior para mais estrelas

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
          // 8% das estrelas têm cor
          hash(seed * 23) > 0.92
            ? starColors[Math.floor(hash(seed * 29) * starColors.length)]
            : "#ffffff",
        speed: baseConfig.speed,
        // Cintilação sutil
        twinkleSpeed: 0.5 + hash(seed * 31) * 1.0,
        twinklePhase: hash(seed * 37) * Math.PI * 2,
        twinkleIntensity: 0.1 + hash(seed * 41) * 0.15,
      };
    };

    return {
      background: Array.from({ length: 2500 }, (_, i) => // Mais estrelas de fundo
        createStar(i + 1000, "bg"),
      ),
      middle: Array.from({ length: 1200 }, (_, i) => // Mais estrelas médias
        createStar(i + 2000, "mid"),
      ),
      foreground: Array.from({ length: 600 }, (_, i) => // Mais estrelas próximas
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

  // Sistema de renderização de estrelas com parallax forte
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

    // Tempo para cintilação sutil
    const currentTime = Date.now() * 0.001;

    // Função hash para geração procedural
    const hash = (x: number, y: number, layer: number) => {
      let h = 1779033703 ^ layer;
      h = Math.imul(h ^ Math.floor(x), 3432918353);
      h = (h << 13) | (h >>> 19);
      h = Math.imul(h ^ Math.floor(y), 461845907);
      h = (h << 13) | (h >>> 19);
      return (h >>> 0) / 4294967296;
    };

    // Gera estrelas com parallax forte
    const generateLayer = (density: number, speed: number, layer: number) => {
      const cameraX = -currentMapX * speed;
      const cameraY = -currentMapY * speed;

      const margin = 150;
      const gridSize = 60; // Grid menor para mais densidade
      const startX = Math.floor((cameraX - margin) / gridSize) * gridSize;
      const endX = Math.ceil((cameraX + canvasWidth + margin) / gridSize) * gridSize;
      const startY = Math.floor((cameraY - margin) / gridSize) * gridSize;
      const endY = Math.ceil((cameraY + canvasHeight + margin) / gridSize) * gridSize;

      for (let gx = startX; gx < endX; gx += gridSize) {
        for (let gy = startY; gy < endY; gy += gridSize) {
          const cellHash = hash(gx, gy, layer);
          const numStars = Math.floor(cellHash * density);

          for (let i = 0; i < numStars; i++) {
            const starHash = hash(gx + i * 137, gy + i * 241, layer + i);
            const starHash2 = hash(gx + i * 173, gy + i * 197, layer + i + 1000);

            const localX = starHash * gridSize;
            const localY = starHash2 * gridSize;

            const worldX = gx + localX;
            const worldY = gy + localY;

            const screenX = worldX - cameraX;
            const screenY = worldY - cameraY;

            if (
              screenX >= -5 &&
              screenX <= canvasWidth + 5 &&
              screenY >= -5 &&
              screenY <= canvasHeight + 5
            ) {
              const sizeHash = hash(worldX * 1.1, worldY * 1.3, layer);
              const opacityHash = hash(worldX * 1.7, worldY * 1.9, layer);
              const colorHash = hash(worldX * 2.1, worldY * 2.3, layer);

              // Tamanhos pequenos e realistas
              const baseSize =
                layer === 1
                  ? 0.3 + sizeHash * 0.5
                  : layer === 2
                    ? 0.5 + sizeHash * 0.7
                    : 0.8 + sizeHash * 1.0;

              const baseOpacity =
                layer === 1
                  ? 0.4 + opacityHash * 0.4
                  : layer === 2
                    ? 0.5 + opacityHash * 0.4
                    : 0.7 + opacityHash * 0.3;

              // Cintilação sutil
              const twinkleSeed = hash(worldX * 3.1, worldY * 3.7, layer);
              const twinkleSpeed = 0.3 + twinkleSeed * 0.7;
              const twinklePhase = twinkleSeed * Math.PI * 2;
              const twinkleIntensity = 0.08 + twinkleSeed * 0.12;
              const twinkleFactor =
                1 + Math.sin(currentTime * twinkleSpeed + twinklePhase) * twinkleIntensity;

              const finalSize = baseSize * twinkleFactor;
              const finalOpacity = Math.min(1, baseOpacity * twinkleFactor);

              // Cores realistas de estrelas
              const isColored = colorHash > 0.92; // 8% coloridas
              let color = "#ffffff";
              
              if (isColored) {
                const colorIndex = Math.floor(colorHash * 7);
                const starColors = [
                  "#ffffff", "#fffacd", "#ffd700", "#ffb347", 
                  "#ff6b47", "#87ceeb", "#4169e1"
                ];
                color = starColors[colorIndex];
              }

              ctx.globalAlpha = finalOpacity;
              ctx.fillStyle = color;

              // Renderiza como ponto de luz pequeno
              ctx.beginPath();
              ctx.arc(screenX, screenY, finalSize, 0, Math.PI * 2);
              ctx.fill();

              // Para estrelas maiores, adiciona um pequeno brilho
              if (layer === 3 && finalSize > 1.2) {
                ctx.globalAlpha = finalOpacity * 0.3;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(screenX, screenY, finalSize * 2, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }
    };

    // Renderiza camadas com parallax forte e mais densidade
    generateLayer(6, 0.1, 1);  // Background - mais estrelas, parallax perceptível
    generateLayer(4, 0.3, 2);  // Middle - parallax médio
    generateLayer(2, 0.6, 3);  // Foreground - parallax forte

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

  // Função para criar faíscas de colisão
  const createCollisionSparks = useCallback(
    (collisionX: number, collisionY: number) => {
      const newSparks = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: collisionX,
        y: collisionY,
        dx: (Math.random() - 0.5) * 120,
        dy: (Math.random() - 0.5) * 120,
      }));

      setSparks(newSparks);

      // Remove faíscas após animação
      setTimeout(() => setSparks([]), 800);
    },
    [],
  );

  // Função para repelir o jogador
  const repelPlayer = useCallback((collisionX: number, collisionY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Calcula direção da repulsão (do centro da barreira para fora)
    const repelDirectionX = collisionX - centerX;
    const repelDirectionY = collisionY - centerY;
    const distance = Math.sqrt(repelDirectionX * repelDirectionX + repelDirectionY * repelDirectionY);

    if (distance > 0) {
      // Normaliza a direção e aplica força de repulsão
      const normalizedX = repelDirectionX / distance;
      const normalizedY = repelDirectionY / distance;
      const repelForce = 15; // Força da repulsão

      // Para o movimento atual imediatamente
      setVelocity({ x: 0, y: 0 });
      setIsDecelerating(false);

      // Aplica repulsão ao mapa (movimento inverso)
      const currentMapX = mapX.get();
      const currentMapY = mapY.get();
      
      animate(mapX, currentMapX - normalizedX * repelForce, { 
        duration: 0.3, 
        ease: "easeOut" 
      });
      animate(mapY, currentMapY - normalizedY * repelForce, { 
        duration: 0.3, 
        ease: "easeOut" 
      });

      // Atualiza posição da nave correspondentemente
      const repelShipX = normalizedX * repelForce / 12;
      const repelShipY = normalizedY * repelForce / 12;
      
      setShipPosition(prev => ({
        x: wrap(prev.x + repelShipX, 0, WORLD_CONFIG.width),
        y: wrap(prev.y + repelShipY, 0, WORLD_CONFIG.height)
      }));
    }
  }, [mapX, mapY]);

  // Função para mostrar notificação de colisão local
  const showCollisionNotification = useCallback(() => {
    const notificationId = Date.now();
    setCollisionNotification({ show: true, id: notificationId });

    // Remove a notificação após 4 segundos
    setTimeout(() => {
      setCollisionNotification(prev => 
        prev.id === notificationId ? { show: false, id: 0 } : prev
      );
    }, 4000);
  }, []);

  // Função para verificar colisão com barreira - versão robusta
  const checkBarrierCollision = useCallback(
    (proposedMapX: number, proposedMapY: number) => {
      // Limites da barreira: de -1200 a +1200 em X e Y (raio 1200px)
      const barrierRadius = 1200;

      // Calcula a distância absoluta do centro usando a fórmula euclidiana
      const distanceFromCenter = Math.sqrt(
        proposedMapX * proposedMapX + proposedMapY * proposedMapY,
      );

      // Só considera colisão se estiver claramente fora da barreira
      // Adiciona uma margem mínima para evitar falsos positivos
      const effectiveRadius = barrierRadius - 5; // Margem de 5px para suavizar

      if (distanceFromCenter >= effectiveRadius) {
        const canvas = canvasRef.current;
        if (!canvas) return { isColliding: true, collisionPoint: null };

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Calcula o ângulo e ponto de colisão
        const angle = Math.atan2(proposedMapY, proposedMapX);
        const collisionX = centerX + Math.cos(angle) * effectiveRadius;
        const collisionY = centerY + Math.sin(angle) * effectiveRadius;

        return {
          isColliding: true,
          collisionPoint: { x: collisionX, y: collisionY },
        };
      }

      return { isColliding: false, collisionPoint: null };
    },
    [],
  );

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

        const currentMapX = mapX.get();
        const currentMapY = mapY.get();
        const deltaMapX = (shipPosRef.current.x - proposedX) * 12;
        const deltaMapY = (shipPosRef.current.y - proposedY) * 12;
        const proposedMapX = currentMapX + deltaMapX;
        const proposedMapY = currentMapY + deltaMapY;

        const collision = checkBarrierCollision(proposedMapX, proposedMapY);
        if (collision.isColliding) {
          // Ativa flash vermelho e faíscas
          setIsColliding(true);
          setTimeout(() => setIsColliding(false), 200); // Flash de 0.2 segundos
          if (collision.collisionPoint) {
            createCollisionSparks(
              collision.collisionPoint.x,
              collision.collisionPoint.y,
            );
            repelPlayer(collision.collisionPoint.x, collision.collisionPoint.y);
          }
          // Reproduz som de colisão
          playBarrierCollisionSound();
          // Mostra notificação
          showCollisionNotification();
          setIsDecelerating(false);
          setVelocity({ x: 0, y: 0 });
          return;
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
  }, [isDragging, mapX, mapY, checkBarrierCollision, createCollisionSparks, repelPlayer, showCollisionNotification]);

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

    // Calcula posição visual proposta baseada no movimento do mapa
    const currentMapX = mapX.get();
    const currentMapY = mapY.get();
    const deltaMapX = (shipPosRef.current.x - proposedX) * 12;
    const deltaMapY = (shipPosRef.current.y - proposedY) * 12;
    const proposedMapX = currentMapX + deltaMapX;
    const proposedMapY = currentMapY + deltaMapY;

    const collision = checkBarrierCollision(proposedMapX, proposedMapY);
    if (collision.isColliding) {
      // Ativa flash vermelho e faíscas
      setIsColliding(true);
      setTimeout(() => setIsColliding(false), 200); // Flash de 0.2 segundos
      if (collision.collisionPoint) {
        createCollisionSparks(
          collision.collisionPoint.x,
          collision.collisionPoint.y,
        );
        repelPlayer(collision.collisionPoint.x, collision.collisionPoint.y);
      }
      // Reproduz som de colisão
      playBarrierCollisionSound();
      // Mostra notificação
      showCollisionNotification();
      newX = shipPosRef.current.x;
      newY = shipPosRef.current.y;
      allowMovement = false;
      setVelocity({ x: 0, y: 0 });
      setIsDecelerating(false);
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

      const currentMapX = mapX.get();
      const currentMapY = mapY.get();
      const deltaMapX = (shipPosRef.current.x - proposedX) * 12;
      const deltaMapY = (shipPosRef.current.y - proposedY) * 12;
      const proposedMapX = currentMapX + deltaMapX;
      const proposedMapY = currentMapY + deltaMapY;

      const collision = checkBarrierCollision(proposedMapX, proposedMapY);
      if (collision.isColliding) {
        // Ativa flash vermelho e faíscas
        setIsColliding(true);
        setTimeout(() => setIsColliding(false), 200); // Flash de 0.2 segundos
        if (collision.collisionPoint) {
          createCollisionSparks(
            collision.collisionPoint.x,
            collision.collisionPoint.y,
          );
          repelPlayer(collision.collisionPoint.x, collision.collisionPoint.y);
        }
        // Reproduz som de colisão
        playBarrierCollisionSound();
        // Mostra notificação
        showCollisionNotification();
        newX = shipPosRef.current.x;
        newY = shipPosRef.current.y;
        allowMovement = false;
        setVelocity({ x: 0, y: 0 });
        setIsDecelerating(false);
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
  }, [
    isDragging,
    mapX,
    mapY,
    shipRotation,
    checkBarrierCollision,
    createCollisionSparks,
    repelPlayer,
    showCollisionNotification,
  ]);

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
      {/* Notificação de Colisão - Centralizada no topo do mapa */}
      {collisionNotification.show && (
        <motion.div
          className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500/20 backdrop-blur-sm text-white p-3 rounded-2xl shadow-2xl border border-red-400/30 max-w-xs"
          initial={{ opacity: 0, y: -30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="text-center">
            <p className="text-xs text-white/90 leading-relaxed">
              <span className="font-semibold">⚠️ Ei!</span> A sua Xenoship mal aguenta a força da gravidade,<br />
              esqueceu que ela é muito frágil pra explorar os cosmos?
            </p>
          </div>
        </motion.div>
      )}

      {/* Canvas para estrelas com parallax forte */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          width: "100%",
          height: "100%",
          willChange: "contents",
        }}
      />

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
        {/* Barreira circular fixa no centro do mapa */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: "50%", // Centro do mundo (100% = WORLD_CONFIG.width)
            top: "50%", // Centro do mundo (100% = WORLD_CONFIG.height)
            width: "2400px", // Diâmetro 2400px = 1200px de raio (2x maior)
            height: "2400px",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            zIndex: 5,
          }}
        >
          {/* Animação de rotação continua */}
          <motion.div
            className="w-full h-full rounded-full border-2 border-dashed"
            style={{
              borderColor: isColliding
                ? "rgba(239, 68, 68, 0.9)"
                : "rgba(255, 255, 255, 0.15)",
            }}
            animate={{
              rotate: 360,
            }}
            transition={{
              rotate: {
                duration: 600, // Rotação muito mais lenta - 10 minutos por volta
                repeat: Infinity,
                ease: "linear",
              },
            }}
          />

          {/* Faíscas de colisão melhoradas */}
          {sparks.map((spark) => (
            <motion.div
              key={spark.id}
              className="absolute w-3 h-3 rounded-full pointer-events-none"
              style={{
                left: spark.x - 6, // Centrar a faísca
                top: spark.y - 6,
                background: "radial-gradient(circle, #ff6b35, #f7931e)",
                boxShadow:
                  "0 0 12px rgba(255, 107, 53, 1), 0 0 24px rgba(247, 147, 30, 0.8)",
                zIndex: 10,
              }}
              initial={{
                x: 0,
                y: 0,
                opacity: 1,
                scale: 1,
              }}
              animate={{
                x: spark.dx,
                y: spark.dy,
                opacity: 0,
                scale: 0.1,
              }}
              transition={{
                duration: 0.8,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
        {/* Renderiza apenas uma vez */}
        <div className="absolute inset-0">{renderPoints()}</div>
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