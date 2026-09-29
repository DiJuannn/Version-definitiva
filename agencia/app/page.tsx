import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current";

export default async function Root() {
  redirect((await getCurrentUser()) ? "/inicio" : "/entrar");
}
