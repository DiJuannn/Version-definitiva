"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AJOLOTE_SPLASH_EVENT } from "@/lib/ajolote-splash-bus";

export function AjoloteSplashOverlay() {
  const [visible, setVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    function handleTrigger() {
      setVisible(true);
    }
    window.addEventListener(AJOLOTE_SPLASH_EVENT, handleTrigger);
    return () => window.removeEventListener(AJOLOTE_SPLASH_EVENT, handleTrigger);
  }, []);

  useEffect(() => {
    if (visible && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setVisible(false)}
        >
          <video
            ref={videoRef}
            src="/ajolote-splash.mp4"
            muted
            playsInline
            className="h-72 w-72 sm:h-96 sm:w-96"
            onEnded={() => setVisible(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
