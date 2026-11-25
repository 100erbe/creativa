"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { Boton } from "@/components/ui/boton";
import { BuscadorAdmin } from "@/components/admin/buscador-admin";
import { cn } from "@/lib/cn";

export type FiltrosDocumentos = {
  tipo?: string;
  estado?: string;
  q?: string;
  cliente?: string;
  cobro?: string;
  revision?: string;
  vista?: string;
  pagina?: string;
};

type OpcionSimple = { valor: string; etiqueta: string };
type OpcionCobro = { valor: string; etiqueta: string; critico: boolean };

function construirEnlace(actual: FiltrosDocumentos, cambios: Partial<FiltrosDocumentos>) {
  const f = { ...actual, ...cambios };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `/admin/documentos?${s}` : "/admin/documentos";
}

/**
 * Barra compacta de búsqueda y filtros (Soluzione 1):
 * - Fila 1: buscador + botón «Filtros» (con contador de filtros avanzados activos).
 * - Fila 2: pestañas horizontales en 1 sola línea para el tipo de documento.
 * - Fila 3 (condicional): chips activos eliminables.
 * - Panel avanzado: Bottom Sheet en móvil y diálogo compacto en escritorio para Cobro, Estado y Revisión.
 */
export function BarraFiltrosDocumentos({
  actual,
  tipos,
  cobros,
  estados,
  revisiones,
  conteoRevision,
  chips,
}: {
  actual: FiltrosDocumentos;
  tipos: readonly OpcionSimple[];
  cobros: readonly OpcionCobro[];
  estados: readonly OpcionSimple[];
  revisiones: readonly OpcionSimple[];
  conteoRevision: Record<string, number>;
  chips: { clave: keyof FiltrosDocumentos; texto: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  // Borrador local dentro del panel para poder combinar filtros antes de aplicar.
  const [borradorCobro, setBorradorCobro] = useState(actual.cobro ?? "");
  const [borradorEstado, setBorradorEstado] = useState(actual.estado ?? "");
  const [borradorRevision, setBorradorRevision] = useState(actual.revision ?? "");

  const activosAvanzados =
    (actual.cobro ? 1 : 0) + (actual.estado ? 1 : 0) + (actual.revision ? 1 : 0);

  function abrirPanel() {
    setBorradorCobro(actual.cobro ?? "");
    setBorradorEstado(actual.estado ?? "");
    setBorradorRevision(actual.revision ?? "");
    setAbierto(true);
  }

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  function aplicarFiltros() {
    const tipoSiguiente =
      borradorCobro && actual.tipo && actual.tipo !== "factura" ? "factura" : borradorCobro ? (actual.tipo || "factura") : actual.tipo;
    const destino = construirEnlace(actual, {
      cobro: borradorCobro,
      estado: borradorEstado,
      revision: borradorRevision,
      tipo: tipoSiguiente,
      pagina: "",
    });
    setAbierto(false);
    router.push(destino);
  }

  function limpiarAvanzados() {
    setBorradorCobro("");
    setBorradorEstado("");
    setBorradorRevision("");
    setAbierto(false);
    router.push(construirEnlace(actual, { cobro: "", estado: "", revision: "", pagina: "" }));
  }

  const hayFiltros = chips.length > 0;
  const rutaLimpia = actual.vista === "tablero" ? "/admin/documentos?vista=tablero" : "/admin/documentos";

  return (
    <>
      <div className="flex flex-col gap-esp3">
        {/* Fila 1: Buscador + botón Filtros */}
        <div className="flex items-center gap-esp2">
          <form action="/admin/documentos" className="flex min-w-0 flex-1 items-center gap-esp2">
            {actual.tipo && <input type="hidden" name="tipo" value={actual.tipo} />}
            {actual.estado && <input type="hidden" name="estado" value={actual.estado} />}
            {actual.cobro && <input type="hidden" name="cobro" value={actual.cobro} />}
            {actual.revision && <input type="hidden" name="revision" value={actual.revision} />}
            {actual.cliente && <input type="hidden" name="cliente" value={actual.cliente} />}
            {actual.vista === "tablero" && <input type="hidden" name="vista" value="tablero" />}
            <BuscadorAdmin
              key={actual.q ?? ""}
              fuente="documentos"
              defaultValue={actual.q ?? ""}
              placeholder="Buscar por número o cliente…"
              ariaLabel="Buscar documentos por número o cliente"
              classNameContenedor="flex-1 md:max-w-md"
              className="h-11 w-full rounded-xl border border-borde-fuerte bg-fondo-superficie pr-esp3 text-base text-texto-primario outline-none transition-colors focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20 md:h-10 md:text-sm"
            />
            <Boton type="submit" variante="secundario" className="hidden sm:inline-flex">
              Buscar
            </Boton>
          </form>

          <button
            type="button"
            onClick={abrirPanel}
            aria-expanded={abierto}
            aria-haspopup="dialog"
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-esp2 rounded-xl border px-esp3 text-sm font-semibold transition-colors duration-rapida ease-suave active:scale-press md:h-10",
              activosAvanzados > 0
                ? "border-borde-marca/35 bg-fondo-marca-sutil text-texto-marca hover:bg-fondo-marca-sutil/80"
                : "border-borde-fuerte bg-fondo-superficie text-texto-primario hover:bg-fondo-sutil",
            )}
          >
            <Icono nombre="filtro" size={16} />
            <span>Filtros</span>
            {activosAvanzados > 0 && (
              <span className="tabular-nums inline-flex h-5 min-w-5 items-center justify-center rounded-completo bg-fondo-marca px-1.5 text-micro font-bold text-texto-sobre-marca">
                {activosAvanzados}
              </span>
            )}
          </button>
        </div>

        {/* Fila 2: Pestañas horizontales de 1 sola línea para el tipo de documento */}
        <div
          role="group"
          aria-label="Tipo de documento"
          className="-mx-esp1 flex items-center gap-esp1 overflow-x-auto px-esp1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[{ valor: "", etiqueta: "Todos" }, ...tipos].map((t) => {
            const activo = (actual.tipo ?? "") === t.valor;
            return (
              <Link
                key={t.valor || "todos"}
                href={construirEnlace(actual, {
                  tipo: t.valor,
                  cobro: t.valor === "" || t.valor === "factura" ? actual.cobro : "",
                  pagina: "",
                })}
                aria-current={activo ? "true" : undefined}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center rounded-lg px-esp3 text-xs font-semibold transition-colors duration-rapida ease-suave active:scale-press",
                  activo
                    ? "bg-texto-primario text-texto-inverso"
                    : "border border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil hover:text-texto-primario",
                )}
              >
                {t.etiqueta}
              </Link>
            );
          })}
        </div>

        {/* Fila 3 (solo si hay filtros activos): chips compactos eliminables */}
        {hayFiltros && (
          <div className="flex flex-wrap items-center gap-esp2 text-xs">
            {chips.map((c) => (
              <Link
                key={c.clave}
                href={construirEnlace(actual, { [c.clave]: "", pagina: "" })}
                aria-label={`Quitar filtro ${c.texto}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-completo border border-borde-fuerte bg-fondo-superficie pl-esp3 pr-esp2 font-medium text-texto-primario transition-colors duration-rapida ease-suave hover:bg-fondo-hover active:scale-press"
              >
                <span className="max-w-[55vw] truncate">{c.texto}</span>
                <span aria-hidden="true" className="text-sm leading-none text-texto-terciario">
                  ×
                </span>
              </Link>
            ))}
            <Link
              href={rutaLimpia}
              className="inline-flex h-8 items-center px-esp2 font-semibold text-texto-marca hover:underline"
            >
              Limpiar
            </Link>
          </div>
        )}
      </div>

      {/* Bottom Sheet (móvil) / Diálogo compacto (escritorio) para filtros avanzados */}
      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-esp4"
          role="dialog"
          aria-modal="true"
          aria-label="Filtros avanzados de documentos"
        >
          <button
            type="button"
            aria-label="Cerrar filtros"
            onClick={() => setAbierto(false)}
            className="animate-velo-entrar absolute inset-0 bg-fondo-velo"
          />
          <div className="animate-hoja-subir md:animate-modal-entrar relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-fondo-superficie shadow-lg md:max-w-lg md:rounded-2xl md:border md:border-borde-default">
            {/* Indicador visual de arrastre en móvil */}
            <div className="flex justify-center pt-esp2 md:hidden" aria-hidden="true">
              <span className="h-1 w-10 rounded-completo bg-borde-fuerte" />
            </div>

            <div className="flex items-center justify-between border-b border-borde-default px-esp5 py-esp3">
              <h2 className="text-base font-bold text-texto-primario">Filtros avanzados</h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar filtros"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-icono-default transition-colors hover:bg-fondo-sutil active:scale-press"
              >
                <Icono nombre="cerrar" size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-esp5 overflow-y-auto px-esp5 py-esp4">
              {/* Grupo 1: Cobro */}
              <div className="space-y-esp2">
                <p className="text-etiqueta uppercase text-texto-secundario">Cobro</p>
                <div className="flex flex-wrap gap-esp2">
                  {cobros.map((c) => {
                    const activo = borradorCobro === c.valor;
                    return (
                      <button
                        key={c.valor}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => {
                          const siguiente = activo ? "" : c.valor;
                          setBorradorCobro(siguiente);
                          if (siguiente) setBorradorEstado("");
                        }}
                        className={cn(
                          "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-esp3 text-xs font-semibold transition-colors duration-rapida ease-suave active:scale-press",
                          c.critico
                            ? activo
                              ? "border-borde-critico bg-fondo-critico text-texto-inverso"
                              : "border-borde-critico-sutil bg-fondo-critico-sutil text-texto-critico hover:border-borde-critico"
                            : activo
                              ? "border-borde-marca bg-fondo-marca text-texto-sobre-marca"
                              : "border-borde-default bg-fondo-sutil text-texto-primario hover:bg-fondo-hover",
                        )}
                      >
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-completo bg-current" />
                        {c.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grupo 2: Estado del documento */}
              <div className="space-y-esp2">
                <p className="text-etiqueta uppercase text-texto-secundario">Estado del documento</p>
                <div className="flex flex-wrap gap-esp2">
                  {estados.map((e) => {
                    const activo = borradorEstado === e.valor;
                    return (
                      <button
                        key={e.valor}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => {
                          const siguiente = activo ? "" : e.valor;
                          setBorradorEstado(siguiente);
                          if (siguiente) setBorradorCobro("");
                        }}
                        className={cn(
                          "inline-flex min-h-10 items-center rounded-lg border px-esp3 text-xs font-medium transition-colors duration-rapida ease-suave active:scale-press",
                          activo
                            ? "border-borde-marca bg-fondo-marca-sutil font-semibold text-texto-marca"
                            : "border-borde-default bg-fondo-sutil text-texto-secundario hover:bg-fondo-hover hover:text-texto-primario",
                        )}
                      >
                        {e.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grupo 3: Revisión */}
              <div className="space-y-esp2">
                <p className="text-etiqueta uppercase text-texto-secundario">Revisión</p>
                <div className="flex flex-wrap gap-esp2">
                  {revisiones.map((r) => {
                    const activo = borradorRevision === r.valor;
                    const n = conteoRevision[r.valor] ?? 0;
                    return (
                      <button
                        key={r.valor}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => setBorradorRevision(activo ? "" : r.valor)}
                        className={cn(
                          "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-esp3 text-xs font-medium transition-colors duration-rapida ease-suave active:scale-press",
                          activo
                            ? "border-borde-marca bg-fondo-marca-sutil font-semibold text-texto-marca"
                            : n > 0
                              ? "border-borde-aviso bg-fondo-aviso-sutil text-texto-aviso hover:opacity-90"
                              : "border-borde-default bg-fondo-sutil text-texto-secundario hover:bg-fondo-hover",
                        )}
                      >
                        <span>{r.etiqueta}</span>
                        <span className="tabular-nums opacity-80">({n})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-esp2 border-t border-borde-default bg-fondo-superficie px-esp5 py-esp3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Boton type="button" variante="secundario" className="flex-1" onClick={limpiarAvanzados}>
                Limpiar
              </Boton>
              <Boton type="button" variante="primario" className="flex-1" onClick={aplicarFiltros}>
                Aplicar filtros
              </Boton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
