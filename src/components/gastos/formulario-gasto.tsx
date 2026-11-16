"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { guardarGasto, type EstadoFormulario } from "@/app/(admin)/admin/gastos/acciones";
import {
  BUCKET_TICKETS,
  ETIQUETA_FORMA_PAGO_GASTO,
  FORMAS_PAGO_GASTO,
  TIPOS_IVA,
  aNumero,
  calcularIva,
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
};

type Opcion = { id: number | string; etiqueta: string };

const entrada =
  "min-h-11 h-11 md:min-h-9 md:h-9 w-full rounded-md border border-borde-campo bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario outline-none focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20";

function Campo({
  etiqueta,
  ayuda,
  children,
  className,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-texto-secundario">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-texto-terciario">{ayuda}</span>}
    </label>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp5">
      <h2 className="text-base font-semibold text-texto-primario">{titulo}</h2>
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
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(guardarGasto, {});
  const editando = inicial?.id != null;
  const [tipo, setTipo] = useState<TipoGasto>(tipoFijo ?? inicial?.tipo ?? "menor");
  const [total, setTotal] = useState(inicial?.total != null ? String(inicial.total).replace(".", ",") : "");
  const [ivaPct, setIvaPct] = useState(String(inicial?.iva_pct ?? 21));
  const [ticket, setTicket] = useState<string | null>(inicial?.ticket_path ?? null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);

  const totalNum = aNumero(total);
  const desglose = totalNum && totalNum > 0 ? calcularIva(totalNum, Number(ivaPct)) : null;

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    setErrorArchivo(null);
    setSubiendo(true);
    try {
      const esPdf = archivo.type === "application/pdf";
      if (!esPdf && !archivo.type.startsWith("image/")) throw new Error("Sube una foto o un PDF.");
      if (esPdf && archivo.size > 2 * 1024 * 1024) throw new Error("El PDF pesa más de 2 MB.");
      const final = esPdf ? archivo : await comprimirImagen(archivo);
      const extension = esPdf ? "pdf" : final.type === "image/webp" ? "webp" : "jpg";
      const ruta = `${usuarioId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await createClient().storage.from(BUCKET_TICKETS).upload(ruta, final, {
        contentType: final.type,
      });
      if (error) throw new Error(error.message);
      setTicket(ruta);
    } catch (e) {
      setErrorArchivo(e instanceof Error ? e.message : "No se pudo subir el archivo.");
    } finally {
      setSubiendo(false);
    }
  }

  const deducible = tipo === "deducible";

  return (
    <form action={accion} className="flex flex-col gap-esp5">
      {editando && <input type="hidden" name="id" value={inicial?.id} />}
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="ticket_path" value={ticket ?? ""} />
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

      <Seccion titulo="El gasto">
        <Campo etiqueta="Concepto *" className="md:col-span-2">
          <input name="concepto" defaultValue={inicial?.concepto} required className={entrada} />
        </Campo>
        <Campo etiqueta="Fecha *">
          <input name="fecha" type="date" defaultValue={inicial?.fecha ?? hoy} required className={entrada} />
        </Campo>
        <Campo etiqueta="Categoría">
          <select name="categoria_id" defaultValue={inicial?.categoria_id ?? ""} className={entrada}>
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
        <Campo etiqueta="Forma de pago *">
          <select name="forma_pago" defaultValue={inicial?.forma_pago ?? "efectivo"} className={entrada}>
            {FORMAS_PAGO_GASTO.map((f) => (
              <option key={f} value={f}>
                {ETIQUETA_FORMA_PAGO_GASTO[f]}
              </option>
            ))}
          </select>
        </Campo>
      </Seccion>

      <Seccion titulo={deducible ? "Importe e IVA" : "Importe"}>
        <Campo etiqueta="Total (IVA incluido) *" ayuda={deducible ? undefined : "No se desglosa IVA en un gasto menor."}>
          <input
            name="total"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="0,00"
            required
            className={cn(entrada, "tabular-nums")}
          />
        </Campo>
        {deducible && (
          <>
            <Campo etiqueta="Tipo de IVA *">
              <select name="iva_pct" value={ivaPct} onChange={(e) => setIvaPct(e.target.value)} className={entrada}>
                {TIPOS_IVA.map((p) => (
                  <option key={p} value={p}>
                    {p} %
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
          <Campo etiqueta="Proveedor *">
            <input name="proveedor" defaultValue={inicial?.proveedor ?? ""} required className={entrada} />
          </Campo>
          <Campo etiqueta="NIF del proveedor">
            <input name="nif_proveedor" defaultValue={inicial?.nif_proveedor ?? ""} className={entrada} />
          </Campo>
          <Campo etiqueta="Nº de factura *">
            <input name="numero_factura" defaultValue={inicial?.numero_factura ?? ""} required className={entrada} />
          </Campo>
        </Seccion>
      )}

      <Seccion titulo={deducible ? "Factura adjunta" : "Ticket"}>
        <div className="flex flex-col gap-esp2 md:col-span-2">
          {ticket ? (
            <div className="flex items-center gap-esp3 rounded-md border border-borde-exito bg-fondo-exito-sutil px-esp4 py-esp3 text-sm text-texto-exito">
              <Icono nombre="check" size={16} />
              <span className="flex-1">Archivo adjuntado</span>
              <button type="button" onClick={() => setTicket(null)} className="text-xs underline">
                Quitar
              </button>
            </div>
          ) : (
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
          )}
          {!ticket && (
            <p className={cn("text-xs", deducible ? "text-texto-aviso" : "text-texto-terciario")}>
              {deducible
                ? "⚠ Sin factura no se puede aprobar el gasto."
                : "⚠ Falta ticket — es opcional, pero conviene adjuntarlo."}
            </p>
          )}
          {errorArchivo && <p className="text-xs text-texto-peligro">{errorArchivo}</p>}
        </div>
        <Campo etiqueta="Notas" className="md:col-span-2">
          <textarea
            name="notas"
            rows={2}
            defaultValue={inicial?.notas ?? ""}
            className="rounded-md border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-sm text-texto-primario outline-none focus:border-borde-foco"
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
        <Link href={cancelarHref}>
          <Boton type="button" variante="secundario">
            Cancelar
          </Boton>
        </Link>
        <Boton type="submit" cargando={pendiente} disabled={subiendo}>
          {editando ? "Guardar cambios" : "Guardar gasto"}
        </Boton>
      </div>
    </form>
  );
}
