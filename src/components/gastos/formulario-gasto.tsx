"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boton, clasesBoton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { desenvolver } from "@/lib/accion";
import { esErrorDeRed } from "@/lib/cola-indexeddb";
import { encolarGasto } from "@/lib/cola-gastos";
import { leerLecturaTicket, type LecturaTicket, type SugerenciaGasto } from "@/lib/datos-ticket";
import { guardarGasto, type EstadoFormulario } from "@/app/(admin)/admin/gastos/acciones";
import { leerTicket } from "@/app/(admin)/admin/gastos/acciones-ticket";
import {
  BUCKET_TICKETS,
  CONCEPTOS_AEAT,
  PCT_DEDUCIBLE_IVA,
  TIPOS_RETENCION,
  cuotaDeducible,
  importeRetencion,
  ETIQUETA_FORMA_PAGO_GASTO,
  FORMAS_PAGO_GASTO,
  TIPOS_IVA,
  aNumero,
  calcularIva,
  etiquetaTipoIva,
  type TipoGasto,
} from "@/lib/gastos";
import { euros } from "@/lib/formato";
import { cn } from "@/lib/cn";

export type DatosGasto = {
  id?: number;
  tipo?: TipoGasto;
  fecha?: string;
  concepto?: string;
  categoria_id?: number | null;
  usuario_id?: string;
  forma_pago?: string;
  total?: number;
  iva_pct?: number | null;
  proveedor?: string | null;
  nif_proveedor?: string | null;
  numero_factura?: string | null;
  ticket_path?: string | null;
  estado?: string;
  notas?: string | null;
  motivo_rechazo?: string | null;
  retencion_pct?: number | null;
  pct_deducible_iva?: number | null;
  bien_inversion?: boolean | null;
  concepto_aeat?: string | null;
  datos_ticket?: unknown;
};

/** Campos que la lectura del ticket puede rellenar. */
type CampoLeido = "concepto" | "fecha" | "total" | "forma_pago" | "categoria_id" | "proveedor" | "nif_proveedor" | "numero_factura" | "iva_pct";

/** Nombre del campo en `campos_dudosos` (lo que devuelve la IA) → campo del formulario. */
const DUDOSO_A_CAMPO: Record<string, CampoLeido> = {
  concepto: "concepto",
  fecha: "fecha",
  total: "total",
  forma_pago: "forma_pago",
  categoria: "categoria_id",
  proveedor: "proveedor",
  nif_proveedor: "nif_proveedor",
  numero_factura: "numero_factura",
  iva_pct: "iva_pct",
};

const LIMITE_LECTURA_MS = 25_000;

type Opcion = { id: number | string; etiqueta: string };

const entrada =
  "min-h-11 h-11 md:min-h-9 md:h-9 w-full rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario outline-none focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20";

function Campo({
  etiqueta,
  ayuda,
  leido,
  children,
  className,
}: {
  etiqueta: string;
  ayuda?: string;
  /** Rellenado por la lectura del ticket: "seguro" o "dudoso" (la IA no lo lee con claridad). */
  leido?: "seguro" | "dudoso";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="flex items-center gap-esp2 text-xs font-medium text-texto-secundario">
        {etiqueta}
        {leido && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-micro font-semibold",
              leido === "dudoso" ? "bg-fondo-aviso-sutil text-texto-aviso" : "bg-fondo-marca-sutil text-texto-marca",
            )}
          >
            {leido === "dudoso" ? "⚠ Compruébalo" : "Leído del ticket"}
          </span>
        )}
      </span>
      {children}
      {ayuda && <span className="text-xs text-texto-terciario">{ayuda}</span>}
    </label>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp5">
      <h2 className="text-titulo-panel text-texto-primario">{titulo}</h2>
      <div className="grid grid-cols-1 gap-esp4 md:grid-cols-2">{children}</div>
    </div>
  );
}

const TIPOS: { valor: TipoGasto; titulo: string; texto: string }[] = [
  {
    valor: "deducible",
    titulo: "Gasto deducible",
    texto: "Factura con IVA recuperable: proveedor, nº de factura e IVA. Entra en el IVA soportado.",
  },
  {
    valor: "menor",
    titulo: "Gasto menor (no deducible)",
    texto: "Pequeño gasto de caja con ticket (peaje, comida, ferretería…). No cuenta para el IVA; se suma aparte.",
  },
];

export function FormularioGasto({
  inicial,
  hoy,
  categorias,
  responsables,
  usuarioId,
  esAdmin,
  cancelarHref,
  tipoFijo,
}: {
  /** Si se da, no se ofrece elegir el tipo (el empleado solo registra gastos menores). */
  tipoFijo?: TipoGasto;
  inicial?: DatosGasto;
  hoy: string;
  categorias: Opcion[];
  /** Solo el admin elige a quién se atribuye el gasto. */
  responsables: Opcion[];
  usuarioId: string;
  esAdmin: boolean;
  cancelarHref: string;
}) {
  const router = useRouter();
  const editando = inicial?.id != null;
  // Sin conexión (o servidor caído) el empleado no pierde el gasto: se guarda en el móvil y se envía solo.
  const puedeGuardarEnMovil = !esAdmin && !editando;
  const [tipo, setTipo] = useState<TipoGasto>(tipoFijo ?? inicial?.tipo ?? "menor");
  const [concepto, setConcepto] = useState(inicial?.concepto ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy);
  const [categoriaId, setCategoriaId] = useState(inicial?.categoria_id != null ? String(inicial.categoria_id) : "");
  const [formaPago, setFormaPago] = useState(inicial?.forma_pago ?? "efectivo");
  const [proveedor, setProveedor] = useState(inicial?.proveedor ?? "");
  const [nifProveedor, setNifProveedor] = useState(inicial?.nif_proveedor ?? "");
  const [numeroFactura, setNumeroFactura] = useState(inicial?.numero_factura ?? "");
  const [total, setTotal] = useState(inicial?.total != null ? String(inicial.total).replace(".", ",") : "");
  const [ivaPct, setIvaPct] = useState(String(inicial?.iva_pct ?? 21));
  const [retencionPct, setRetencionPct] = useState(String(Number(inicial?.retencion_pct ?? 0)));
  const [pctDeducible, setPctDeducible] = useState(String(Number(inicial?.pct_deducible_iva ?? 100)));
  const [ticket, setTicket] = useState<string | null>(inicial?.ticket_path ?? null);
  /** Foto que no se pudo subir por falta de conexión: viaja con el gasto guardado en el móvil. */
  const [ticketEnMovil, setTicketEnMovil] = useState<Blob | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [lectura, setLectura] = useState<LecturaTicket | null>(() => leerLecturaTicket(inicial?.datos_ticket ?? null));
  const [leyendo, setLeyendo] = useState(false);
  const [avisoTicket, setAvisoTicket] = useState<string | null>(null);
  const [leidos, setLeidos] = useState<Partial<Record<CampoLeido, "seguro" | "dudoso">>>({});
  /** Campos que la persona ya ha tocado: la lectura no los pisa. */
  const tocados = useRef(new Set<CampoLeido>());

  function tocar(campo: CampoLeido) {
    tocados.current.add(campo);
    setLeidos((l) => {
      if (!l[campo]) return l;
      const resto = { ...l };
      delete resto[campo];
      return resto;
    });
  }

  async function guardarEnMovil(formData: FormData): Promise<EstadoFormulario> {
    const guardado = await encolarGasto(formData, usuarioId, ticketEnMovil);
    if (!guardado) {
      return { error: "No hay conexión y este móvil no permite guardar el gasto. Inténtalo cuando tengas cobertura." };
    }
    router.push("/app/gastos");
    return {};
  }

  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(async (previo, formData) => {
    if (puedeGuardarEnMovil && (ticketEnMovil || navigator.onLine === false)) return guardarEnMovil(formData);
    try {
      return await guardarGasto(previo, formData);
    } catch (e) {
      if (puedeGuardarEnMovil && esErrorDeRed(e)) return guardarEnMovil(formData);
      throw e;
    }
  }, {});

  /** Rellena con la lectura del ticket los campos que la persona aún no ha tocado. */
  function aplicar(s: SugerenciaGasto) {
    const l = s.lectura;
    setLectura(l);
    if (l.tipo_documento === "otro" && !s.total) {
      setAvisoTicket("La foto no parece un ticket ni una factura. Revisa la foto o rellena los datos a mano.");
      return;
    }
    const dudosos = new Set(l.campos_dudosos.map((c) => DUDOSO_A_CAMPO[c]).filter(Boolean));
    const nuevos: Partial<Record<CampoLeido, "seguro" | "dudoso">> = {};
    const poner = (campo: CampoLeido, valor: string | number | null | undefined, fijar: (v: string) => void) => {
      if (valor == null || valor === "" || tocados.current.has(campo)) return;
      fijar(String(valor));
      nuevos[campo] = dudosos.has(campo) ? "dudoso" : "seguro";
    };
    poner("concepto", s.concepto, setConcepto);
    poner("fecha", s.fecha, setFecha);
    poner("total", s.total != null ? s.total.toFixed(2).replace(".", ",") : null, setTotal);
    poner("forma_pago", s.forma_pago, setFormaPago);
    poner("categoria_id", s.categoria_id, setCategoriaId);
    if (tipo === "deducible") {
      poner("proveedor", l.proveedor, setProveedor);
      poner("nif_proveedor", l.nif_proveedor, setNifProveedor);
      poner("numero_factura", l.numero_factura, setNumeroFactura);
      if (l.iva_pct != null && (TIPOS_IVA as readonly number[]).includes(l.iva_pct)) poner("iva_pct", l.iva_pct, setIvaPct);
    }
    setLeidos(nuevos);
    setAvisoTicket(
      Object.keys(nuevos).length > 0
        ? "Hemos rellenado los datos del ticket. Compruébalos antes de enviar."
        : "No hemos podido leer datos del ticket. Rellénalos a mano.",
    );
  }

  async function leer(ruta: string) {
    setLeyendo(true);
    setAvisoTicket(null);
    try {
      const limite = new Promise<never>((_, rechazar) =>
        setTimeout(() => rechazar(new Error("tiempo agotado")), LIMITE_LECTURA_MS),
      );
      aplicar(await Promise.race([desenvolver(leerTicket(ruta)), limite]));
    } catch {
      // El ticket ya está guardado: al enviar el gasto se volverá a leer en el servidor para la administración.
      setAvisoTicket("No hemos podido leer el ticket ahora. Rellena los datos a mano: la foto se guarda igualmente.");
    } finally {
      setLeyendo(false);
    }
  }

  function quitarTicket() {
    setTicket(null);
    setTicketEnMovil(null);
    setLectura(null);
    setLeidos({});
    setAvisoTicket(null);
  }

  const totalNum = aNumero(total);
  const desglose = totalNum && totalNum > 0 ? calcularIva(totalNum, Number(ivaPct)) : null;
  const retencion = desglose ? importeRetencion(desglose.base, Number(retencionPct)) : 0;
  const deducibleIva = desglose ? cuotaDeducible(desglose.cuota, Number(pctDeducible)) : 0;
  // Si el tipo de retención guardado no es uno de los habituales, se ofrece igualmente.
  const opcionesRetencion = [...new Set<number>([...TIPOS_RETENCION, Number(retencionPct) || 0])].sort((a, b) => a - b);

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    quitarTicket();
    setErrorArchivo(null);
    setSubiendo(true);
    let final: File | null = null;
    let ruta: string | null = null;
    try {
      const esPdf = archivo.type === "application/pdf";
      if (!esPdf && !archivo.type.startsWith("image/")) throw new Error("Sube una foto o un PDF.");
      if (esPdf && archivo.size > 2 * 1024 * 1024) throw new Error("El PDF pesa más de 2 MB.");
      final = esPdf ? archivo : await comprimirImagen(archivo);
      const extension = esPdf ? "pdf" : final.type === "image/webp" ? "webp" : "jpg";
      ruta = `${usuarioId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await createClient().storage.from(BUCKET_TICKETS).upload(ruta, final, {
        contentType: final.type,
      });
      if (error) throw new Error(error.message);
      setTicket(ruta);
    } catch (e) {
      ruta = null;
      if (final && puedeGuardarEnMovil && esErrorDeRed(e)) {
        setTicketEnMovil(final);
        setAvisoTicket("Sin conexión: rellena los datos y envía. El gasto se guarda en el móvil y se enviará solo cuando vuelva la cobertura.");
      } else {
        setErrorArchivo(e instanceof Error ? e.message : "No se pudo subir el archivo.");
      }
    } finally {
      setSubiendo(false);
    }
    if (ruta) await leer(ruta);
  }

  const deducible = tipo === "deducible";
  const hayTicket = !!ticket || !!ticketEnMovil;

  const bloqueTicket = (
    <div className="flex flex-col gap-esp2 md:col-span-2">
      {hayTicket ? (
        <div
          className={cn(
            "flex items-center gap-esp3 rounded-md border px-esp4 py-esp3 text-sm",
            ticket ? "border-borde-exito bg-fondo-exito-sutil text-texto-exito" : "border-borde-aviso bg-fondo-aviso-sutil text-texto-primario",
          )}
        >
          <Icono nombre={ticket ? "check" : "camara"} size={16} />
          <span className="flex-1">
            {leyendo ? "Leyendo el ticket…" : ticket ? "Ticket adjuntado" : "Ticket guardado en el móvil"}
          </span>
          <button type="button" onClick={quitarTicket} disabled={leyendo} className="text-xs underline">
            Quitar
          </button>
        </div>
      ) : editando ? (
        <label className="flex cursor-pointer items-center gap-esp3 rounded-md border border-dashed border-borde-campo px-esp4 py-esp4 text-sm text-texto-secundario hover:bg-fondo-sutil">
          <Icono nombre="camara" size={18} />
          {subiendo ? "Subiendo…" : "Hacer foto o elegir archivo (imagen o PDF)"}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            disabled={subiendo}
            onChange={(e) => subir(e.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="flex flex-col items-center gap-esp3 rounded-xl border border-dashed border-borde-marca bg-fondo-marca-sutil px-esp4 py-esp5 text-center">
          <Icono nombre="camara" size={28} className="text-texto-marca" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-texto-primario">Escanea el ticket o la factura</p>
            <p className="text-xs text-texto-secundario">Leemos los datos por ti: solo tienes que comprobarlos.</p>
          </div>
          <label className={clasesBoton("primario", "m", cn("cursor-pointer", subiendo && "pointer-events-none opacity-60"))}>
            <Icono nombre="camara" size={16} />
            {subiendo ? "Subiendo…" : "Escanear ticket"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={subiendo}
              onChange={(e) => subir(e.target.files?.[0])}
            />
          </label>
          <label className="cursor-pointer text-xs font-medium text-texto-marca underline">
            o elegir una foto o un PDF
            <input
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              disabled={subiendo}
              onChange={(e) => subir(e.target.files?.[0])}
            />
          </label>
        </div>
      )}
      {avisoTicket && !leyendo && <p className="text-xs text-texto-secundario">{avisoTicket}</p>}
      {!hayTicket && editando && (
        <p className={cn("text-xs", deducible ? "text-texto-aviso" : "text-texto-terciario")}>
          {deducible
            ? "⚠ Sin factura no se puede aprobar el gasto."
            : "⚠ Falta ticket — es opcional, pero conviene adjuntarlo."}
        </p>
      )}
      {errorArchivo && <p className="text-xs text-texto-peligro">{errorArchivo}</p>}
    </div>
  );

  return (
    <form action={accion} className="flex flex-col gap-esp5">
      {editando && <input type="hidden" name="id" value={inicial?.id} />}
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="ticket_path" value={ticket ?? ""} />
      <input type="hidden" name="datos_ticket" value={lectura ? JSON.stringify(lectura) : ""} />
      {!esAdmin && <input type="hidden" name="usuario_id" value={usuarioId} />}

      <div className={cn("grid grid-cols-1 gap-esp3 md:grid-cols-2", tipoFijo && "hidden")}>
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            type="button"
            onClick={() => setTipo(t.valor)}
            aria-pressed={tipo === t.valor}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border px-esp4 py-esp4 text-left transition-colors",
              tipo === t.valor
                ? "border-borde-marca bg-fondo-marca-sutil"
                : "border-borde-default bg-fondo-superficie hover:bg-fondo-sutil",
            )}
          >
            <span className="text-sm font-semibold text-texto-primario">{t.titulo}</span>
            <span className="text-xs text-texto-secundario">{t.texto}</span>
          </button>
        ))}
      </div>

      {!editando && <div className="grid grid-cols-1 md:grid-cols-2">{bloqueTicket}</div>}

      <Seccion titulo="El gasto">
        <Campo etiqueta="Concepto *" className="md:col-span-2" leido={leidos.concepto}>
          <input
            name="concepto"
            value={concepto}
            onChange={(e) => {
              tocar("concepto");
              setConcepto(e.target.value);
            }}
            required
            className={entrada}
          />
        </Campo>
        <Campo etiqueta="Fecha *" leido={leidos.fecha}>
          <input
            name="fecha"
            type="date"
            value={fecha}
            onChange={(e) => {
              tocar("fecha");
              setFecha(e.target.value);
            }}
            required
            className={entrada}
          />
        </Campo>
        <Campo etiqueta="Categoría" leido={leidos.categoria_id}>
          <select
            name="categoria_id"
            value={categoriaId}
            onChange={(e) => {
              tocar("categoria_id");
              setCategoriaId(e.target.value);
            }}
            className={entrada}
          >
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        {esAdmin && (
          <Campo etiqueta="Responsable *">
            <select name="usuario_id" defaultValue={inicial?.usuario_id ?? usuarioId} required className={entrada}>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo etiqueta="Forma de pago *" leido={leidos.forma_pago}>
          <select
            name="forma_pago"
            value={formaPago}
            onChange={(e) => {
              tocar("forma_pago");
              setFormaPago(e.target.value);
            }}
            className={entrada}
          >
            {FORMAS_PAGO_GASTO.map((f) => (
              <option key={f} value={f}>
                {ETIQUETA_FORMA_PAGO_GASTO[f]}
              </option>
            ))}
          </select>
        </Campo>
      </Seccion>

      <Seccion titulo={deducible ? "Importe e IVA" : "Importe"}>
        <Campo
          etiqueta="Total (IVA incluido) *"
          ayuda={deducible ? undefined : "No se desglosa IVA en un gasto menor."}
          leido={leidos.total}
        >
          <input
            name="total"
            inputMode="decimal"
            value={total}
            onChange={(e) => {
              tocar("total");
              setTotal(e.target.value);
            }}
            placeholder="0,00"
            required
            className={cn(entrada, "tabular-nums")}
          />
        </Campo>
        {deducible && (
          <>
            <Campo etiqueta="Tipo de IVA *" leido={leidos.iva_pct}>
              <select
                name="iva_pct"
                value={ivaPct}
                onChange={(e) => {
                  tocar("iva_pct");
                  setIvaPct(e.target.value);
                }}
                className={entrada}
              >
                {TIPOS_IVA.map((p) => (
                  <option key={p} value={p}>
                    {etiquetaTipoIva(p)}
                  </option>
                ))}
              </select>
            </Campo>
            <div className="tabular-nums flex flex-wrap gap-esp5 rounded-md bg-fondo-sutil px-esp4 py-esp3 text-sm md:col-span-2">
              <span className="text-texto-secundario">
                Base imponible{" "}
                <strong className="text-texto-primario">{desglose ? euros(desglose.base) : "—"}</strong>
              </span>
              <span className="text-texto-secundario">
                Cuota IVA <strong className="text-texto-primario">{desglose ? euros(desglose.cuota) : "—"}</strong>
              </span>
            </div>
          </>
        )}
      </Seccion>

      {deducible && (
        <Seccion titulo="Proveedor y factura">
          <Campo etiqueta="Proveedor *" leido={leidos.proveedor}>
            <input
              name="proveedor"
              value={proveedor}
              onChange={(e) => {
                tocar("proveedor");
                setProveedor(e.target.value);
              }}
              required
              className={entrada}
            />
          </Campo>
          <Campo etiqueta="NIF del proveedor" leido={leidos.nif_proveedor}>
            <input
              name="nif_proveedor"
              value={nifProveedor}
              onChange={(e) => {
                tocar("nif_proveedor");
                setNifProveedor(e.target.value);
              }}
              className={entrada}
            />
          </Campo>
          <Campo etiqueta="Nº de factura *" leido={leidos.numero_factura}>
            <input
              name="numero_factura"
              value={numeroFactura}
              onChange={(e) => {
                tocar("numero_factura");
                setNumeroFactura(e.target.value);
              }}
              required
              className={entrada}
            />
          </Campo>
        </Seccion>
      )}

      {deducible && (
        <Seccion titulo="Datos fiscales">
          <Campo
            etiqueta="Concepto fiscal (libro registro AEAT)"
            className="md:col-span-2"
            ayuda="Clasifica el gasto en el libro de compras y gastos que se presenta con el 303 y el 130."
          >
            <select name="concepto_aeat" defaultValue={inicial?.concepto_aeat ?? ""} className={entrada}>
              <option value="">Sin clasificar</option>
              {CONCEPTOS_AEAT.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.codigo} · {c.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            etiqueta="Retención IRPF practicada"
            ayuda={retencion > 0 ? `Se retienen ${euros(retencion)} · a pagar ${euros((totalNum ?? 0) - retencion)}` : "Facturas de profesionales (habitual 15 %, 7 % los primeros años)."}
          >
            <select name="retencion_pct" value={retencionPct} onChange={(e) => setRetencionPct(e.target.value)} className={entrada}>
              {opcionesRetencion.map((p) => (
                <option key={p} value={p}>
                  {p === 0 ? "Sin retención" : `${p} %`}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            etiqueta="IVA deducible"
            ayuda={desglose && Number(pctDeducible) < 100 ? `Se deducen ${euros(deducibleIva)} de ${euros(desglose.cuota)}` : "50 % para turismos que no se usan solo para la actividad."}
          >
            <select name="pct_deducible_iva" value={pctDeducible} onChange={(e) => setPctDeducible(e.target.value)} className={entrada}>
              {PCT_DEDUCIBLE_IVA.map((p) => (
                <option key={p} value={p}>
                  {p} %
                </option>
              ))}
            </select>
          </Campo>
          <label className="flex items-start gap-esp3 md:col-span-2">
            <input
              type="checkbox"
              name="bien_inversion"
              defaultChecked={!!inicial?.bien_inversion}
              className="mt-0.5 h-4 w-4"
            />
            <span className="flex flex-col">
              <span className="text-sm text-texto-primario">Bien de inversión</span>
              <span className="text-xs text-texto-terciario">
                Vehículos, maquinaria, ordenadores… que duran más de un año. Su IVA va en las casillas 30–31 del 303.
              </span>
            </span>
          </label>
        </Seccion>
      )}

      <Seccion titulo={editando ? (deducible ? "Factura adjunta" : "Ticket") : "Notas"}>
        {editando && bloqueTicket}
        <Campo etiqueta="Notas" className="md:col-span-2">
          <textarea
            name="notas"
            rows={2}
            defaultValue={inicial?.notas ?? ""}
            className="rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-sm text-texto-primario outline-none focus:border-borde-foco"
          />
        </Campo>
        {esAdmin && (
          <Campo etiqueta="Estado">
            <select name="estado" defaultValue={inicial?.estado === "rechazado" ? "pendiente" : (inicial?.estado ?? "pendiente")} className={entrada}>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="reembolsado">Reembolsado</option>
            </select>
          </Campo>
        )}
      </Seccion>

      {estado.error && (
        <p className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp4 py-esp3 text-sm text-texto-peligro">
          {estado.error}
        </p>
      )}

      <div className="flex gap-esp3">
        <Link href={cancelarHref} className={clasesBoton("secundario", "m")}>
          Cancelar
        </Link>
        <Boton type="submit" cargando={pendiente} disabled={subiendo || leyendo}>
          {editando ? "Guardar cambios" : "Guardar gasto"}
        </Boton>
      </div>
    </form>
  );
}
