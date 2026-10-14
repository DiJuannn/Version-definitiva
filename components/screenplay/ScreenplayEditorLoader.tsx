"use client";

import dynamic from "next/dynamic";
import { EditorSkeleton } from "@/components/screenplay/EditorSkeleton";

// El editor (TipTap + Yjs) solo se descarga al abrir un guion.
const ScreenplayEditor = dynamic(() => import("@/components/screenplay/ScreenplayEditor"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

export function ScreenplayEditorLoader(props: React.ComponentProps<typeof ScreenplayEditor>) {
  return <ScreenplayEditor {...props} />;
}
