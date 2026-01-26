/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import toast from "react-hot-toast";
import { isOnline, onOnlineStatusChange } from "../lib/offline";

/**
 * Mobile app wrapper that handles:
 * - Online/offline status
 * - Back button handling
 * - App initialization
 */
export function MobileAppWrapper({ children }) {
  const [isAppOnline, setIsAppOnline] = useState(true);

  useEffect(() => {
    // Check initial online status
    setIsAppOnline(isOnline());

    // Listen for online/offline changes
    onOnlineStatusChange((online) => {
      setIsAppOnline(online);
      if (online) {
        toast.success("Back online! Syncing changes...");
      } else {
        toast("You're offline. Changes will sync when online.", {
          icon: "📴",
        });
      }
    });

    // Handle Android back button
    const handleBackButton = () => {
      // Prevent app from closing on back button
      // Instead, just go back in navigation
      window.history.back();
    };

    CapacitorApp.addListener("backButton", handleBackButton);

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, []);

  return (
    <div className={isAppOnline ? "" : "opacity-75"}>
      {!isAppOnline && (
        <div className="fixed bottom-0 left-0 right-0 bg-amber-100 text-amber-900 px-4 py-2 text-sm font-medium z-40">
          📴 Offline Mode - Changes will sync when online
        </div>
      )}
      {children}
    </div>
  );
}
