"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PresentUser = { userId: string; label: string };

// Presencia efímera vía Supabase Realtime — no se guarda en la base de
// datos, solo vive mientras la pestaña está abierta. Un canal por proyecto
// (no por organización), así que funciona igual para el propietario que
// para alguien con acceso por enlace compartido.
export function ProjectPresence({
  projectId,
  userId,
  userLabel,
}: {
  projectId: string;
  userId: string;
  userLabel: string;
}) {
  const [others, setOthers] = useState<PresentUser[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`project-presence:${projectId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ label: string }>();
        const present: PresentUser[] = [];
        for (const [key, entries] of Object.entries(state)) {
          if (key === userId || entries.length === 0) continue;
          present.push({ userId: key, label: entries[0].label });
        }
        setOthers(present);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ label: userLabel });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, userId, userLabel]);

  if (others.length === 0) return null;

  const text =
    others.length === 1
      ? `${others[0].label} también está aquí ahora`
      : `${others.length} personas más están aquí ahora`;

  return (
    <div className="mb-4 flex items-center gap-2 border border-accent/40 bg-accent/10 px-3 py-2 font-mono text-[11px] text-accent">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      {text}
    </div>
  );
}
