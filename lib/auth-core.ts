import type { SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export type SignUpInput = {
  organizationName: string;
  fullName: string;
  email: string;
  password: string;
};

export type SignUpResult =
  | { ok: true; session: { access_token: string; refresh_token: string } | null }
  | { ok: false; error: string };

// Compartido entre signUp (Server Action de la web, lib/actions/auth.ts)
// y POST /api/mobile/auth/signup — la única diferencia entre las dos
// superficies es qué cliente de Supabase reciben (uno con cookies para
// dejar la sesión de navegador, otro sin cookies para devolver los
// tokens en el JSON) y qué hacen con el resultado (redirigir vs
// responder JSON). La validación y la creación de la productora son
// exactamente las mismas.
export async function signUpCore(
  supabase: SupabaseClient,
  input: SignUpInput,
  emailRedirectTo: string,
): Promise<SignUpResult> {
  const organizationName = input.organizationName?.trim() ?? "";
  const fullName = input.fullName?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  const password = input.password ?? "";

  if (!organizationName || !email || password.length < 8) {
    return {
      ok: false,
      error:
        "Revisa los campos: falta el nombre de la productora o la contraseña tiene menos de 8 caracteres.",
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) {
    // Se registra el error real de Supabase (código + mensaje) porque el
    // texto que ve el usuario es deliberadamente corto — sin esto, un
    // fallo nuevo que no esté en la lista de abajo es indistinguible de
    // cualquier otro con el genérico "No se pudo crear la cuenta".
    console.error("signUpCore: fallo en supabase.auth.signUp", {
      code: error.code,
      message: error.message,
      status: error.status,
    });

    const KNOWN_ERRORS: Record<string, string> = {
      user_already_exists: "Ya existe una cuenta con ese email.",
      weak_password: "La contraseña es demasiado débil. Prueba con una más larga o con más variedad de caracteres.",
      email_address_invalid: "Ese email no es válido o no se admite. Prueba con otro.",
      // Límite de envío de emails de confirmación de Supabase — no es un
      // fallo de la cuenta en sí, sino una cuota temporal del propio
      // servicio de correo. Se soluciona configurando un proveedor de
      // email propio en Supabase, o esperando a que se reinicie la cuota.
      over_email_send_rate_limit:
        "Se han pedido demasiadas confirmaciones de email en poco tiempo. Espera unos minutos y vuelve a intentarlo.",
      signup_disabled: "El registro de cuentas nuevas está desactivado ahora mismo. Contacta con soporte.",
    };

    return {
      ok: false,
      error: KNOWN_ERRORS[error.code ?? ""] ?? "No se pudo crear la cuenta. Inténtalo de nuevo.",
    };
  }

  if (!data.user) {
    return { ok: false, error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
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
      ok: false,
      error:
        "La cuenta se creó pero hubo un problema guardando la productora. Contacta con soporte.",
    };
  }

  return {
    ok: true,
    session: data.session
      ? { access_token: data.session.access_token, refresh_token: data.session.refresh_token }
      : null,
  };
}
