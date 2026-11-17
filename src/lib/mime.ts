// Monta un email MIME (RFC 5322 / 2045) con texto y adjuntos, listo para subirlo a Gmail
// como borrador. Lógica pura, sin dependencias, para poder probarla aparte.

import { emailValido } from "./reclamacion";

export type Adjunto = { nombre: string; tipo: string; contenido: Uint8Array };

export type Mensaje = {
  para: string[];
  asunto: string;
  cuerpo: string;
  adjuntos: Adjunto[];
};

function base64(datos: Uint8Array | string) {
  return Buffer.from(typeof datos === "string" ? Buffer.from(datos, "utf8") : datos).toString("base64");
}

/** Base64 partido en líneas de 76 caracteres, como pide MIME. */
function base64EnLineas(datos: Uint8Array | string) {
  return base64(datos).replace(/.{76}(?=.)/g, "$&\r\n");
}

const soloAscii = (t: string) => /^[\x20-\x7e]*$/.test(t);

/** Cabecera con acentos codificada como «=?UTF-8?B?…?=» (RFC 2047), en trozos que no partan caracteres. */
export function codificarCabecera(texto: string) {
  if (soloAscii(texto)) return texto;
  const trozos: string[] = [];
  let actual = "";
  for (const caracter of texto) {
    if (Buffer.byteLength(actual + caracter, "utf8") > 45) {
      trozos.push(actual);
      actual = "";
    }
    actual += caracter;
  }
  if (actual) trozos.push(actual);
  return trozos.map((t) => `=?UTF-8?B?${base64(t)}?=`).join("\r\n ");
}

/**
 * Nombre de archivo para las cabeceras del adjunto. Con acentos se codifica como palabra
 * RFC 2047 entre comillas, que es lo que genera y entiende el propio Gmail.
 */
export function nombreEnCabecera(nombre: string) {
  const limpio = nombre.replace(/["\\\r\n]/g, "_");
  return soloAscii(limpio) ? limpio : `=?UTF-8?B?${base64(limpio)}?=`;
}

export function construirMensaje(m: Mensaje, limite = `limite_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`) {
  const para = m.para.map((e) => e.trim()).filter(Boolean);
  const malos = para.filter((e) => !emailValido(e));
  if (malos.length) throw new Error(`Dirección de email no válida: ${malos.join(", ")}`);
  if (/[\r\n]/.test(m.asunto)) throw new Error("El asunto no puede tener saltos de línea.");

  const cuerpo = m.cuerpo.replace(/\r?\n/g, "\r\n");
  const lineas = [
    ...(para.length ? [`To: ${para.join(", ")}`] : []),
    `Subject: ${codificarCabecera(m.asunto)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${limite}"`,
    "",
    `--${limite}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64EnLineas(cuerpo),
  ];
  for (const a of m.adjuntos) {
    const nombre = nombreEnCabecera(a.nombre);
    lineas.push(
      `--${limite}`,
      `Content-Type: ${a.tipo}; name="${nombre}"`,
      `Content-Disposition: attachment; filename="${nombre}"`,
      "Content-Transfer-Encoding: base64",
      "",
      base64EnLineas(a.contenido),
    );
  }
  lineas.push(`--${limite}--`, "");
  return lineas.join("\r\n");
}
