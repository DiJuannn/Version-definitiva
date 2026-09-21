"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TOOL_MODE_COOKIE, WELCOME_COOKIE } from "@/lib/tool-access";
import type { ToolMode } from "@/lib/tool-rules";

// «Mostrar todas las herramientas» / «Volver al modo simple»: se recuerda en este dispositivo.
export async function setToolMode(mode: ToolMode): Promise<void> {
  if (mode !== "simple" && mode !== "full") return;
  (await cookies()).set(TOOL_MODE_COOKIE, mode, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/app", "layout");
}

// «Entendido» en la bienvenida al proyecto: no se vuelve a enseñar sola en este dispositivo.
export async function dismissWelcome(projectId: string): Promise<void> {
  (await cookies()).set(WELCOME_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(`/app/${projectId}`);
}
