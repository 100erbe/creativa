import "server-only";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { cifradoConfigurado, cifrar, descifrar } from "@/lib/cifrado";

// Conexión con la cuenta de Gmail del administrador (OAuth de Google) para dejar
// borradores con adjuntos. El refresh token vive en la tabla cuenta_gmail, que solo
// lee el servidor con la service_role key: nunca llega al navegador. Además se guarda
// cifrado (AES-256-GCM con TOKENS_SECRET, ver lib/cifrado.ts).
//
// Permiso pedido: gmail.compose (crear borradores). La app no lee el correo.

export const AMBITO_GMAIL = "https://www.googleapis.com/auth/gmail.compose";
export const COOKIE_ESTADO_OAUTH = "gmail_oauth_estado";

export function gmailConfigurado() {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && cifradoConfigurado();
}

/** Dirección a la que Google devuelve al usuario tras dar permiso. Debe estar registrada en Google Cloud. */
export function urlRetornoOAuth(origen: string) {
  return `${origen}/api/gmail/retorno`;
}

export function urlAutorizacion(origen: string, estado: string) {
  const parametros = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: urlRetornoOAuth(origen),
    response_type: "code",
    scope: AMBITO_GMAIL,
    access_type: "offline",
    // «consent» obliga a Google a devolver siempre un refresh token nuevo.
    prompt: "consent",
    include_granted_scopes: "true",
    state: estado,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${parametros}`;
}

type RespuestaToken = { access_token?: string; refresh_token?: string; error?: string; error_description?: string };

async function pedirToken(cuerpo: Record<string, string>): Promise<RespuestaToken> {
  const respuesta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...cuerpo,
    }),
    cache: "no-store",
  });
  return (await respuesta.json().catch(() => ({ error: `HTTP ${respuesta.status}` }))) as RespuestaToken;
}

function clienteAdmin() {
  const admin = crearClienteAdmin();
  if (!admin) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  return admin;
}

/** Canjea el código de Google, averigua la dirección de la cuenta y la guarda como cuenta conectada. */
export async function conectarCuenta(codigo: string, origen: string, usuarioId: string) {
  const token = await pedirToken({
    code: codigo,
    grant_type: "authorization_code",
    redirect_uri: urlRetornoOAuth(origen),
  });
  if (!token.access_token || !token.refresh_token) {
    throw new Error(token.error_description ?? token.error ?? "Google no ha devuelto el permiso.");
  }
  // Se cifra antes de nada: sin TOKENS_SECRET no se guarda ninguna conexión.
  const tokenCifrado = cifrar(token.refresh_token);
  const perfil = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  if (!perfil.ok) throw new Error("No se ha podido leer la dirección de la cuenta de Gmail.");
  const { emailAddress } = (await perfil.json()) as { emailAddress?: string };
  if (!emailAddress) throw new Error("No se ha podido leer la dirección de la cuenta de Gmail.");

  const { error } = await clienteAdmin()
    .from("cuenta_gmail")
    .upsert({
      id: 1,
      email: emailAddress,
      refresh_token: tokenCifrado,
      conectada_por: usuarioId,
      conectada_en: new Date().toISOString(),
    });
  if (error) throw new Error(`No se ha podido guardar la conexión: ${error.message}`);
  return emailAddress;
}

/** Cuenta conectada (solo la dirección), o null. */
export async function cuentaConectada(): Promise<{ email: string; conectadaEn: string } | null> {
  const admin = crearClienteAdmin();
  if (!admin) return null;
  const { data } = await admin.from("cuenta_gmail").select("email, conectada_en").eq("id", 1).maybeSingle();
  return data ? { email: data.email, conectadaEn: data.conectada_en } : null;
}

/** Quita la conexión: revoca el permiso en Google (si se puede) y borra el token. */
export async function desconectarCuenta() {
  const admin = clienteAdmin();
  const { data } = await admin.from("cuenta_gmail").select("refresh_token").eq("id", 1).maybeSingle();
  if (data?.refresh_token) {
    let tokenClaro: string | null = null;
    try {
      tokenClaro = descifrar(data.refresh_token);
    } catch {
      // Sin la clave no se puede revocar en Google, pero la conexión se borra igualmente.
    }
    if (tokenClaro) {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: tokenClaro }),
      }).catch(() => undefined);
    }
  }
  const { error } = await admin.from("cuenta_gmail").delete().eq("id", 1);
  if (error) throw new Error(error.message);
}

const RECONECTAR = "La conexión con Gmail ha caducado o se ha retirado el permiso. Vuelve a conectarla en Ajustes → Gmail.";

/**
 * Crea un borrador en la cuenta conectada con el mensaje MIME ya montado.
 * Devuelve los ids y el enlace que abre el borrador en Gmail.
 */
export async function crearBorrador(mensajeMime: string) {
  if (!gmailConfigurado()) throw new Error("Gmail no está configurado en el servidor (faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).");
  const admin = clienteAdmin();
  const { data: cuenta } = await admin.from("cuenta_gmail").select("email, refresh_token").eq("id", 1).maybeSingle();
  if (!cuenta) throw new Error("No hay ninguna cuenta de Gmail conectada. Conéctala en Ajustes → Gmail.");

  const token = await pedirToken({ refresh_token: descifrar(cuenta.refresh_token), grant_type: "refresh_token" });
  if (!token.access_token) throw new Error(token.error === "invalid_grant" ? RECONECTAR : `Google: ${token.error_description ?? token.error}`);

  // Subida «media»: el cuerpo es el mensaje RFC 822 tal cual (admite adjuntos de hasta 35 MB).
  const respuesta = await fetch("https://gmail.googleapis.com/upload/gmail/v1/users/me/drafts?uploadType=media", {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "message/rfc822" },
    body: mensajeMime,
    cache: "no-store",
  });
  if (respuesta.status === 401 || respuesta.status === 403) throw new Error(RECONECTAR);
  if (!respuesta.ok) {
    const detalle = (await respuesta.text().catch(() => "")).slice(0, 300);
    throw new Error(`Gmail no ha aceptado el borrador (HTTP ${respuesta.status}). ${detalle}`);
  }
  const borrador = (await respuesta.json()) as { id: string; message: { id: string } };
  return {
    remitente: cuenta.email,
    borradorId: borrador.id,
    mensajeId: borrador.message.id,
    url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(cuenta.email)}#drafts?compose=${borrador.message.id}`,
  };
}
