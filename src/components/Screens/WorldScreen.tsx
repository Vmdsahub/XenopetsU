import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GalaxyMap } from "../World/GalaxyMap";
import { DetailView } from "../World/DetailView";

export const WorldScreen: React.FC = () => {
  const [currentView, setCurrentView] = useState<"map" | "detail">("map");
  const [selectedPoint, setSelectedPoint] = useState<any>(null);

  const handlePointClick = (pointId: string, pointData: any) => {
    setSelectedPoint(pointData);
    setCurrentView("detail");
  };

  const handleBackToMap = () => {
    setCurrentView("map");
    setSelectedPoint(null);
  };

  return (
    <div className="max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {currentView === "map" ? (
          <motion.div
            key="galaxy-map"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
          >
            {/* Galaxy Map Card */}
            <motion.div
              className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-100">
                <div className="text-center">
                  <h3 className="font-bold text-xl text-gray-900">
                    Mapa Galáctico
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Explore mundos desconhecidos
                  </p>
                </div>
              </div>

              {/* Galaxy Map */}
              <div className="p-4">
                <GalaxyMap onPointClick={handlePointClick} />
              </div>

              {/* Instructions */}
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <div className="text-center text-sm text-gray-600">
                  <p className="mb-2">🚀 Navegue arrastando o mapa</p>
                  <p className="mb-2">
                    🎯 Aproxime-se dos pontos para ativá-los
                  </p>
                  <p>🌍 Clique nos pontos para explorar</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="detail-view"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <DetailView pointData={selectedPoint} onBack={handleBackToMap} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
