"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { signUpCore } from "@/lib/auth-core";

export type AuthActionState = { error: string } | undefined;

// Solo se sigue un "next" que sea una ruta relativa de la propia app — si
// viniera algo como "https://otra-web.com", sería una redirección abierta
// (alguien podría mandar un enlace de login nuestro que acabe en su web).
function safeNextPath(value: FormDataEntryValue | null): string | null {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : null;
}

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

  redirect(safeNextPath(formData.get("next")) ?? "/app");
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const result = await signUpCore(
    supabase,
    {
      organizationName: String(formData.get("organizationName") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    },
    `${origin}/app/login?confirmed=1`,
  );

  if (!result.ok) {
    return { error: result.error };
  }

  if (!result.session) {
    redirect("/app/login?confirm=1");
  }

  redirect("/app");
}

export async function acceptInvite(
  token: string,
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.status !== "PENDING") {
    return { error: "Esta invitación ya no es válida. Pide una nueva." };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const { data, error } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: { emailRedirectTo: `${origin}/app/login?confirmed=1` },
  });

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
    await prisma.$transaction([
      prisma.user.create({
        data: {
          id: data.user.id,
          email: invite.email,
          fullName: fullName || null,
          organizationId: invite.organizationId,
          role: invite.role,
        },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      }),
    ]);
  } catch {
    return {
      error:
        "La cuenta se creó pero hubo un problema al unirla al equipo. Contacta con soporte.",
    };
  }

  if (!data.session) {
    redirect("/app/login?confirm=1");
  }

  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/app/login");
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
    redirectTo: `${origin}/app/reset-password`,
  });

  redirect("/app/forgot-password?sent=1");
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

  redirect("/app");
}
