import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, Info, Eye } from "lucide-react";

interface DetailPoint {
  id: string;
  x: number; // Percentage position
  y: number; // Percentage position
  name: string;
  description: string;
  type: "building" | "landmark" | "resource" | "mystery";
}

interface DetailViewProps {
  pointData: {
    id: string;
    name: string;
    description: string;
    type: string;
    image?: string;
  };
  onBack: () => void;
}

// Sample detail points for each location
const DETAIL_POINTS: Record<string, DetailPoint[]> = {
  "terra-nova": [
    {
      id: "capital-city",
      x: 35,
      y: 45,
      name: "Cidade Capital",
      description: "Centro político e comercial do planeta",
      type: "building",
    },
    {
      id: "crystal-caves",
      x: 70,
      y: 30,
      name: "Cavernas de Cristal",
      description: "Formações cristalinas com propriedades energéticas",
      type: "resource",
    },
    {
      id: "floating-islands",
      x: 20,
      y: 60,
      name: "Ilhas Flutuantes",
      description: "Misteriosas ilhas que desafiam a gravidade",
      type: "mystery",
    },
    {
      id: "ancient-temple",
      x: 85,
      y: 70,
      name: "Templo Antigo",
      description: "Ruínas de uma civilização perdida",
      type: "landmark",
    },
  ],
  "estacao-omega": [
    {
      id: "docking-bay",
      x: 40,
      y: 35,
      name: "Baía de Atracação",
      description: "Principal ponto de entrada da estação",
      type: "building",
    },
    {
      id: "market-district",
      x: 60,
      y: 50,
      name: "Distrito Comercial",
      description: "Centro de comércio galáctico",
      type: "building",
    },
    {
      id: "reactor-core",
      x: 25,
      y: 70,
      name: "Núcleo do Reator",
      description: "Fonte de energia da estação",
      type: "resource",
    },
  ],
  "nebulosa-crimson": [
    {
      id: "energy-storms",
      x: 45,
      y: 40,
      name: "Tempestades Energéticas",
      description: "Fenômenos eletromagnéticos intensos",
      type: "mystery",
    },
    {
      id: "research-outpost",
      x: 70,
      y: 25,
      name: "Posto de Pesquisa",
      description: "Estação científica abandonada",
      type: "building",
    },
    {
      id: "crystal-formation",
      x: 30,
      y: 65,
      name: "Formação Cristalina",
      description: "Cristais que absorvem energia da nebulosa",
      type: "resource",
    },
  ],
};

const getPointTypeIcon = (type: string) => {
  switch (type) {
    case "building":
      return "🏢";
    case "landmark":
      return "🏛️";
    case "resource":
      return "💎";
    case "mystery":
      return "❓";
    default:
      return "📍";
  }
};

const getPointTypeColor = (type: string) => {
  switch (type) {
    case "building":
      return "#3b82f6";
    case "landmark":
      return "#8b5cf6";
    case "resource":
      return "#f59e0b";
    case "mystery":
      return "#ef4444";
    default:
      return "#6b7280";
  }
};

export const DetailView: React.FC<DetailViewProps> = ({
  pointData,
  onBack,
}) => {
  const [selectedDetailPoint, setSelectedDetailPoint] =
    useState<DetailPoint | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const detailPoints = DETAIL_POINTS[pointData.id] || [];

  const handleDetailPointClick = (point: DetailPoint) => {
    setSelectedDetailPoint(point);
  };

  return (
    <motion.div
      className="max-w-md mx-auto"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header Card */}
      <motion.div
        className="bg-white rounded-2xl shadow-lg mb-4 p-4 border border-gray-100"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Voltar ao Mapa</span>
          </button>

          <div className="flex items-center gap-2 text-blue-600">
            <Eye size={16} />
            <span className="text-sm font-medium">Exploração</span>
          </div>
        </div>
      </motion.div>

      {/* Main Image Card */}
      <motion.div
        className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-100">
          <div className="text-center">
            <h3 className="font-bold text-xl text-gray-900">
              {pointData.name}
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              {pointData.description}
            </p>
          </div>
        </div>

        {/* Interactive Image */}
        <div className="relative">
          <div
            className="relative w-full h-80 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${pointData.image || "https://images.pexels.com/photos/87651/earth-blue-planet-globe-planet-87651.jpeg"})`,
            }}
          >
            {/* Overlay for better point visibility */}
            <div className="absolute inset-0 bg-black/10" />

            {/* Detail points */}
            {detailPoints.map((point) => (
              <motion.div
                key={point.id}
                className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 z-10"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                }}
                onClick={() => handleDetailPointClick(point)}
                onHoverStart={() => setHoveredPoint(point.id)}
                onHoverEnd={() => setHoveredPoint(null)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + Math.random() * 0.3 }}
              >
                {/* Point marker */}
                <motion.div
                  className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm border-2 border-white/50"
                  style={{
                    backgroundColor: getPointTypeColor(point.type),
                    boxShadow:
                      hoveredPoint === point.id
                        ? `0 0 20px ${getPointTypeColor(point.type)}`
                        : `0 0 8px ${getPointTypeColor(point.type)}60`,
                  }}
                  animate={{
                    boxShadow:
                      hoveredPoint === point.id
                        ? `0 0 20px ${getPointTypeColor(point.type)}`
                        : `0 0 8px ${getPointTypeColor(point.type)}60`,
                  }}
                >
                  <span className="text-xs text-white">
                    {getPointTypeIcon(point.type)}
                  </span>
                </motion.div>

                {/* Pulse effect */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-white"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.8, 0.3, 0.8],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* Hover tooltip */}
                {hoveredPoint === point.id && (
                  <motion.div
                    className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap backdrop-blur-sm border border-white/20 pointer-events-none"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                  >
                    <div className="font-medium">{point.name}</div>
                    <div className="text-gray-300 text-xs">
                      {point.description}
                    </div>

                    {/* Tooltip arrow */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Info footer */}
        <div className="p-4 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-600 text-sm">
            <MapPin size={16} />
            <span>Clique nos pontos para explorar locais específicos</span>
          </div>
        </div>
      </motion.div>

      {/* Selected Point Modal */}
      <AnimatePresence>
        {selectedDetailPoint && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDetailPoint(null)}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl mb-4"
                  style={{
                    backgroundColor: getPointTypeColor(
                      selectedDetailPoint.type,
                    ),
                  }}
                >
                  <span className="text-white">
                    {getPointTypeIcon(selectedDetailPoint.type)}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {selectedDetailPoint.name}
                </h3>

                <p className="text-gray-600 mb-6">
                  {selectedDetailPoint.description}
                </p>

                <button
                  onClick={() => setSelectedDetailPoint(null)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
