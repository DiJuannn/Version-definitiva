"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { TOOL_MODE_COOKIE } from "@/lib/tool-access";
import type { ToolMode } from "@/lib/tool-rules";

// «Mostrar todas las herramientas» / «Volver al modo simple»: se recuerda en este dispositivo.
export async function setToolMode(mode: ToolMode): Promise<void> {
  if (mode !== "simple" && mode !== "full") return;
  (await cookies()).set(TOOL_MODE_COOKIE, mode, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/app", "layout");
}
