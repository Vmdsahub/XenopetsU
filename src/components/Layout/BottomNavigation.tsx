import React from "react";
import { Heart, Globe, Package, User, Shield } from "lucide-react";
import { useGameStore } from "../../store/gameStore";
import { motion } from "framer-motion";

const navigationItems = [
  { id: "pet", label: "Pet", icon: Heart, color: "text-pink-500" },
  { id: "world", label: "Mundo", icon: Globe, color: "text-blue-500" },
  {
    id: "inventory",
    label: "Inventário",
    icon: Package,
    color: "text-orange-500",
  },
  { id: "profile", label: "Perfil", icon: User, color: "text-purple-500" },
];

export const BottomNavigation: React.FC = () => {
  const { currentScreen, setCurrentScreen, user } = useGameStore();

  // Add admin navigation for admin users
  const items = user?.isAdmin
    ? [
        ...navigationItems,
        { id: "admin", label: "Admin", icon: Shield, color: "text-red-500" },
      ]
    : navigationItems;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-lg">
      <div
        className={`flex justify-around max-w-md mx-auto px-2 py-2 ${user?.isAdmin ? "grid grid-cols-5" : "grid grid-cols-4"}`}
      >
        {items.map(({ id, label, icon: Icon, color }) => {
          const isActive = currentScreen === id;

          return (
            <motion.button
              key={id}
              onClick={() => setCurrentScreen(id)}
              className={`flex flex-col items-center py-2 px-2 rounded-xl transition-all duration-200 ${
                isActive ? "bg-gray-100" : "hover:bg-gray-50"
              } ${id === "admin" ? "relative" : ""}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className={`p-1 rounded-lg ${isActive ? color : "text-gray-400"} ${
                  id === "admin" && isActive ? "bg-red-50" : ""
                }`}
                animate={{
                  scale: isActive ? 1.1 : 1,
                  rotate: isActive ? [0, -10, 10, 0] : 0,
                }}
                transition={{ duration: 0.3 }}
              >
                <Icon className="w-6 h-6" />
              </motion.div>
              <span
                className={`text-xs font-medium mt-1 transition-colors ${
                  isActive ? "text-gray-900" : "text-gray-500"
                }`}
              >
                {label}
              </span>
              {isActive && (
                <motion.div
                  className={`w-1 h-1 rounded-full mt-1 ${
                    id === "admin" ? "bg-red-500" : "bg-blue-500"
                  }`}
                  layoutId="activeIndicator"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
