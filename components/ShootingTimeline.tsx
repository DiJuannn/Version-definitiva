"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { assignSceneToDay } from "@/lib/actions/shooting-days";
import { FeatureIntro } from "@/components/FeatureIntro";

export type TimelineScene = {
  id: string;
  number: string;
  intExtLabel: string;
  dayPartLabel: string;
  locationName: string | null;
  dayId: string | null;
};

export type TimelineDay = {
  id: string;
  label: string;
  conflicts: { personName: string; reason: string }[];
};

const UNASSIGNED = "__unassigned__";

function SceneCard({
  scene,
  onDragStart,
}: {
  scene: TimelineScene;
  onDragStart: (sceneId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", scene.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(scene.id);
      }}
      className="cursor-grab border border-line bg-bg p-2.5 active:cursor-grabbing"
    >
      <p className="font-mono text-xs font-bold">Escena {scene.number}</p>
      <p className="mt-0.5 font-mono text-[10px] text-muted">
        {scene.intExtLabel} · {scene.dayPartLabel}
        {scene.locationName ? ` · ${scene.locationName}` : ""}
      </p>
    </div>
  );
}

export function ShootingTimeline({
  projectId,
  days,
  initialScenes,
  viewerLabel,
}: {
  projectId: string;
  days: TimelineDay[];
  initialScenes: TimelineScene[];
  viewerLabel: string;
}) {
  const [scenes, setScenes] = useState(initialScenes);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [otherViewers, setOtherViewers] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const senderIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!senderIdRef.current) senderIdRef.current = crypto.randomUUID();
    const supabase = createClient();
    const channel = supabase.channel(`plan-de-rodaje:${projectId}`, {
      config: { presence: { key: senderIdRef.current } },
    });

    channel
      .on("broadcast", { event: "scene-moved" }, ({ payload }) => {
        if (payload.senderId === senderIdRef.current) return;
        setScenes((prev) =>
          prev.map((s) =>
            s.id === payload.sceneId ? { ...s, dayId: payload.dayId } : s,
          ),
        );
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ label: string }>();
        const labels = Object.entries(state)
          .filter(([key]) => key !== senderIdRef.current)
          .flatMap(([, entries]) => entries.map((e) => e.label));
        setOtherViewers([...new Set(labels)]);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ label: viewerLabel });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const byColumn = useMemo(() => {
    const map = new Map<string, TimelineScene[]>();
    map.set(UNASSIGNED, []);
    for (const day of days) map.set(day.id, []);
    for (const scene of scenes) {
      const key = scene.dayId ?? UNASSIGNED;
      const list = map.get(key);
      if (list) list.push(scene);
      else map.get(UNASSIGNED)!.push(scene);
    }
    return map;
  }, [scenes, days]);

  function dropSceneOn(targetDayId: string | null, e: React.DragEvent) {
    e.preventDefault();
    setDragOverId(null);
    const sceneId = e.dataTransfer.getData("text/plain");
    if (!sceneId) return;

    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, dayId: targetDayId } : s)),
    );
    channelRef.current?.send({
      type: "broadcast",
      event: "scene-moved",
      payload: { sceneId, dayId: targetDayId, senderId: senderIdRef.current },
    });
    startTransition(() => {
      assignSceneToDay(projectId, sceneId, targetDayId);
    });
  }

  return (
    <div className="mt-8">
      <FeatureIntro featureId="shooting-timeline">
        Arrastra una escena de una columna a otra para cambiarla de día de
        rodaje — se guarda sola, sin formularios. La columna &ldquo;Sin
        asignar&rdquo; son las escenas que todavía no tienen día. Si alguien
        más tiene esta pantalla abierta a la vez, los cambios se ven al
        instante en las dos pantallas.
      </FeatureIntro>

      {otherViewers.length > 0 && (
        <div className="mt-4 flex items-center gap-2 font-mono text-[10px] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Viendo ahora: {otherViewers.join(", ")}
        </div>
      )}

      <div className="mt-4 flex gap-4 overflow-x-auto pb-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId(UNASSIGNED);
          }}
          onDragLeave={() => setDragOverId((id) => (id === UNASSIGNED ? null : id))}
          onDrop={(e) => dropSceneOn(null, e)}
          className={
            "flex w-56 shrink-0 flex-col gap-2 border p-3 transition-colors " +
            (dragOverId === UNASSIGNED ? "border-accent" : "border-line")
          }
        >
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Sin asignar ({byColumn.get(UNASSIGNED)?.length ?? 0})
          </p>
          <div className="flex flex-col gap-2">
            {(byColumn.get(UNASSIGNED) ?? []).map((scene) => (
              <SceneCard key={scene.id} scene={scene} onDragStart={() => {}} />
            ))}
            {(byColumn.get(UNASSIGNED) ?? []).length === 0 && (
              <p className="font-mono text-[10px] text-muted">Todo asignado.</p>
            )}
          </div>
        </div>

        {days.map((day) => (
          <div
            key={day.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverId(day.id);
            }}
            onDragLeave={() => setDragOverId((id) => (id === day.id ? null : id))}
            onDrop={(e) => dropSceneOn(day.id, e)}
            className={
              "flex w-56 shrink-0 flex-col gap-2 border p-3 transition-colors " +
              (dragOverId === day.id ? "border-accent" : "border-line")
            }
          >
            <div className="flex items-center justify-between">
              <Link
                href={`/app/${projectId}/plan-de-rodaje/${day.id}`}
                className="font-mono text-[10px] tracking-widest text-fg uppercase hover:text-accent"
              >
                {day.label}
              </Link>
              <span className="font-mono text-[10px] text-muted">
                {byColumn.get(day.id)?.length ?? 0}
              </span>
            </div>

            {day.conflicts.length > 0 && (
              <div className="border border-accent p-2">
                {day.conflicts.map((c, i) => (
                  <p key={i} className="font-mono text-[10px] text-accent">
                    ⚠ {c.personName} — {c.reason}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {(byColumn.get(day.id) ?? []).map((scene) => (
                <SceneCard key={scene.id} scene={scene} onDragStart={() => {}} />
              ))}
              {(byColumn.get(day.id) ?? []).length === 0 && (
                <p className="font-mono text-[10px] text-muted">
                  Arrastra escenas aquí.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
