"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type AuthActionState = { error: string } | undefined;

export async function logIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

  redirect("/taller");
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!organizationName || !email || password.length < 8) {
    return {
      error:
        "Revisa los campos: falta el nombre de la productora o la contraseña tiene menos de 8 caracteres.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return {
      error:
        error.code === "user_already_exists"
          ? "Ya existe una cuenta con ese email."
          : "No se pudo crear la cuenta. Inténtalo de nuevo.",
    };
  }

  if (!data.user) {
    return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }

  try {
    await prisma.organization.create({
      data: {
        name: organizationName,
        users: {
          create: {
            id: data.user.id,
            email,
            fullName: fullName || null,
          },
        },
      },
    });
  } catch {
    return {
      error:
        "La cuenta se creó pero hubo un problema guardando la productora. Contacta con soporte.",
    };
  }

  if (!data.session) {
    redirect("/login?confirm=1");
  }

  redirect("/taller");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Escribe tu email." };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  // No comprobamos el resultado a propósito: si el email no existe, damos
  // la misma respuesta que si existiera, para no revelar qué cuentas hay.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  redirect("/forgot-password?sent=1");
}

export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      error: "No se pudo actualizar la contraseña. Pide un enlace nuevo.",
    };
  }

  redirect("/taller");
}
