import { NextResponse } from "next/server";
import { sendTaskReminders } from "@/lib/task-reminders";

// Misma protección que el cron de call sheets — solo Vercel puede
// dispararla, mandando el CRON_SECRET automáticamente (ver vercel.json).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await sendTaskReminders();
  return NextResponse.json(result);
}
