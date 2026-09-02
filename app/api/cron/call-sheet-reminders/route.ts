import { NextResponse } from "next/server";
import { sendCallSheetReminders } from "@/lib/call-sheet-reminders";

// Vercel llama a esta ruta una vez al día (ver vercel.json) mandando
// automáticamente la cabecera Authorization con CRON_SECRET — así nadie
// más puede disparar el envío de recordatorios visitando la URL a mano.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await sendCallSheetReminders();
  return NextResponse.json(result);
}
