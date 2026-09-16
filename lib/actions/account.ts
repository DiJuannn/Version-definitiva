"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { deleteOwnAccountCore } from "@/lib/account-delete-core";
import { createClient } from "@/lib/supabase/server";

export type DeleteAccountState = { error: string } | undefined;

export async function deleteOwnAccount(
  // Firma exigida por useActionState (prevState, formData), sin usarlos.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: DeleteAccountState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<DeleteAccountState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "No se pudo borrar la cuenta." };

  const result = await deleteOwnAccountCore(profile.id, profile.organizationId);
  if ("error" in result) return result;

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/app/login?deleted=1");
}
