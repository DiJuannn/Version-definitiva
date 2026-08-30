"use client";

import { useEffect, useState } from "react";

function storageKey(featureId: string) {
  return `vd-intro-${featureId}`;
}

export function FeatureIntro({
  featureId,
  children,
}: {
  featureId: string;
  children: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(localStorage.getItem(storageKey(featureId)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [featureId]);

  if (dismissed) return null;

  return (
    <div className="mt-6 flex items-start justify-between gap-4 border border-line bg-bg-raised p-4">
      <p className="font-mono text-xs leading-relaxed text-muted">{children}</p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(storageKey(featureId), "1");
          } catch {}
          setDismissed(true);
        }}
        className="shrink-0 font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
      >
        Entendido
      </button>
    </div>
  );
}
