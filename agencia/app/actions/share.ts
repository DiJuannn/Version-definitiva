"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/auth/session";
import { formToObject, runAction, type ActionState } from "@/lib/http/action";
import { identifyGuest } from "@/lib/services/shares";

export async function identifyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const token = String(fd.get("token") ?? "");
  const res = await runAction(async () => {
    await identifyGuest(token, formToObject(fd), clientIp(await headers()));
  });
  if (res?.ok) redirect(`/r/${token}`);
  return res;
}
