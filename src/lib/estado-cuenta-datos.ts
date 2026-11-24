import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { componerDireccionEnLineas } from "@/lib/direccion";
import { clienteCorto, etiquetaDocumentoIdentidad, formatoEuros, nombreArchivo } from "@/lib/documento-impresion";
import { fechaNumerica } from "@/lib/formato";
import { calcularEstadoCuenta, hoyEnEspana, type DocumentoCobro, type EstadoCuenta } from "@/lib/estado-cuenta";

const LOGO_PRINCIPAL = "/brand/logo-creativa.svg";
const LOGO_SECUNDARIO = "/brand/logo-crea-comunicacion.svg";

export type DatosEstadoCuenta = {
  clienteId: number;
  cliente: { razonSocial: string; documento: string | null; direccion: string };
  empresa: {
    nombreComercial: string | null;
    razonSocial: string | null;
    nif: string | null;
    direccion: string;
    telefonos: string;
    email: string | null;
    lema: string | null;
    logoPrincipal: string;
    logoSecundario: string | null;
  };
  cuenta: { banco: string; iban: string } | null;
  estado: EstadoCuenta;
  /** Emails del cliente que reciben las facturas (contactos marcados + email de facturación). */
  destinatarios: string[];
};

type Supabase = SupabaseClient<Database>;

/** Reúne todo lo que necesita el estado de cuenta de un cliente. null si el cliente no existe. */
export async function cargarEstadoCuenta(supabase: Supabase, clienteId: number): Promise<DatosEstadoCuenta | null> {
  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("id, razon_social, tipo_documento, numero_documento, direccion, codigo_postal, municipio, provincia, email_facturacion, cuenta_cobro_id")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cliente) return null;

  const resultados = await Promise.all([
    supabase
      .from("v_estado_cobro")
      .select("id, tipo, numero_completo, fecha, total, cobrado, pendiente")
      .eq("cliente_id", clienteId),
    supabase
      .from("documentos")
      .select("id, estado, documento_origen_id, campana, descripcion, fecha_vencimiento")
      .eq("cliente_id", clienteId)
      .in("tipo", ["factura", "rectificativa"])
      .neq("estado", "borrador"),
    supabase.from("empresa").select("*").limit(1).maybeSingle(),
    supabase.from("cuentas_bancarias").select("id, banco, iban, por_defecto, activa"),
    supabase.from("contactos_cliente").select("email").eq("cliente_id", clienteId).eq("recibe_facturas", true),
  ]);
  lanzarSiError(...resultados);
  const [{ data: cobros }, { data: docs }, { data: empresa }, { data: cuentas }, { data: contactos }] = resultados;

  const extra = new Map((docs ?? []).map((d) => [d.id, d]));
  const documentos: DocumentoCobro[] = (cobros ?? []).flatMap((c) => {
    const d = c.id != null ? extra.get(c.id) : undefined;
    // Las anuladas no se deben: no salen en el estado de cuenta.
    if (!d || d.estado === "anulado" || !c.fecha || (c.tipo !== "factura" && c.tipo !== "rectificativa")) return [];
    return [
      {
        id: d.id,
        tipo: c.tipo,
        numero: c.numero_completo ?? `#${d.id}`,
        fecha: c.fecha,
        fechaVencimiento: d.fecha_vencimiento,
        total: Number(c.total ?? 0),
        cobrado: Number(c.cobrado ?? 0),
        pendiente: Number(c.pendiente ?? 0),
        origenId: d.documento_origen_id,
        concepto: [d.campana, d.descripcion].filter(Boolean).join(" · ") || null,
      },
    ];
  });

  const activas = (cuentas ?? []).filter((c) => c.activa);
  const cuenta =
    activas.find((c) => c.id === cliente.cuenta_cobro_id) ?? activas.find((c) => c.por_defecto) ?? activas[0] ?? null;

  const destinatarios = [
    ...new Set(
      [...(contactos ?? []).map((c) => c.email), cliente.email_facturacion]
        .map((e) => e?.trim().toLowerCase())
        .filter((e): e is string => !!e),
    ),
  ];

  return {
    clienteId,
    cliente: {
      razonSocial: cliente.razon_social,
      documento: cliente.numero_documento
        ? etiquetaDocumentoIdentidad(cliente.tipo_documento, cliente.numero_documento)
        : null,
      direccion: componerDireccionEnLineas({
        direccion: cliente.direccion,
        codigoPostal: cliente.codigo_postal,
        municipio: cliente.municipio,
        provincia: cliente.provincia,
      }),
    },
    empresa: {
      nombreComercial: empresa?.nombre_comercial ?? null,
      razonSocial: empresa?.razon_social ?? null,
      nif: empresa?.nif ?? null,
      direccion: empresa
        ? componerDireccionEnLineas({
            direccion: empresa.direccion,
            codigoPostal: empresa.codigo_postal,
            municipio: empresa.municipio,
            provincia: empresa.provincia,
          })
        : "",
      telefonos: [empresa?.telefono ? `Tlf. ${empresa.telefono}` : null, empresa?.movil ? `Móvil ${empresa.movil}` : null]
        .filter(Boolean)
        .join(" · "),
      email: empresa?.email ?? null,
      lema: empresa?.lema ?? null,
      logoPrincipal: empresa?.logo_url || LOGO_PRINCIPAL,
      logoSecundario: LOGO_SECUNDARIO,
    },
    cuenta: cuenta ? { banco: cuenta.banco, iban: cuenta.iban } : null,
    estado: calcularEstadoCuenta(documentos, hoyEnEspana()),
    destinatarios,
  };
}

/** «Estado de cuenta SEA LIFE CENTRE SPAIN 2026-11-24» (sin extensión): la fecha al revés para que se ordenen solos. */
export function nombreArchivoEstadoCuenta(razonSocial: string, fecha: string) {
  return `Estado de cuenta ${clienteCorto(razonSocial)} ${fecha.slice(0, 10)}`.slice(0, 100).trim();
}

/** Nombre del PDF de una factura adjunta a la reclamación: el mismo que en el resto de la app. */
export function nombreArchivoFactura(tipo: string, numero: string, razonSocial: string, concepto: string | null) {
  return nombreArchivo({ tipo, numero, razonSocial, descripcion: concepto });
}

/** Asunto y texto propuestos para el email de reclamación (el administrador los puede cambiar). */
export function mensajeReclamacion(d: DatosEstadoCuenta) {
  const { estado } = d;
  const asunto = `Facturas pendientes de pago – ${d.cliente.razonSocial}`;
  const lista = estado.insolutas
    .map(
      (l) =>
        `  · ${l.numero} del ${fechaNumerica(l.fecha)} — pendiente ${formatoEuros(l.saldo)} (vencida el ${fechaNumerica(l.vencimiento)})`,
    )
    .join("\n");
  const abonos =
    estado.abonosPendientes < 0
      ? `\nAbonos a su favor pendientes de aplicar: ${formatoEuros(estado.abonosPendientes)}\nImporte a pagar: ${formatoEuros(estado.totalAReclamar)}\n`
      : "";
  const pago = d.cuenta
    ? `mediante transferencia a la cuenta ${d.cuenta.iban} (${d.cuenta.banco})`
    : "por el medio habitual";
  const firma = [d.empresa.nombreComercial, d.empresa.telefonos, d.empresa.email].filter(Boolean).join("\n");
  const cuerpo = `Buenos días:

Según nuestros registros, a fecha ${fechaNumerica(estado.fecha)} las siguientes facturas vencidas siguen pendientes de pago:

${lista}

Total vencido: ${formatoEuros(estado.totalInsoluto)}
${abonos}
Les adjuntamos el estado de cuenta con todas sus facturas y una copia de cada factura pendiente. Les agradeceríamos que realizaran el pago ${pago} o que nos indicaran la fecha prevista de pago.

Si ya lo han abonado, por favor, no tengan en cuenta este mensaje y envíennos el justificante.

Un saludo,
${firma}`;
  return { asunto, cuerpo };
}
