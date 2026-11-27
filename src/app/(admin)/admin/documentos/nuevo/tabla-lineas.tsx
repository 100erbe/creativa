"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { euros } from "@/lib/formato";
import { actualizarLinea, eliminarLinea } from "./acciones";
import { desenvolver } from "@/lib/accion";
import { confirmar } from "@/components/ui/dialogos";
import { UNIDAD, num, texto } from "./lineas-comun";
import type { Linea } from "./lineas-comun";
import { eliminarOptimista, useSinOcultos } from "@/lib/eliminacion-optimista";
import { Tarjeta } from "@/components/ui/tarjeta";
import { InsigniaMargen } from "@/components/ui/insignia-margen";
import { margenLinea } from "@/lib/margen";
import { useMargenesVisibles } from "@/lib/margenes-visibles";

/** Lista dinámica y compacta de lo ya añadido; se actualiza con cada router.refresh(). */
export function ListaCompacta({ lineas }: { lineas: Linea[] }) {
  return (
    <div className="flex flex-col gap-esp2">
      <p className="text-xs font-medium uppercase tracking-wide text-texto-terciario">
        Ya añadidos ({lineas.length})
      </p>
      <ul className="flex max-h-60 flex-col gap-esp2 overflow-y-auto">
        {lineas.map((l) => (
          <li key={l.id} className="flex items-start gap-esp2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-texto-primario" title={l.descripcion}>
                {l.descripcion}
              </span>
              <span className="block truncate text-xs text-texto-terciario">
                {l.artista ? `${l.artista} · ` : ""}
                {texto(l.piezas, 3)} ud
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-texto-primario">{euros(l.importe)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Formulario para añadir un artículo del catálogo (inserción rápida)
// ---------------------------------------------------------------------

export function TablaLineas({
  documentoId,
  lineas: lineasServidor,
  descuentoGlobalPct = 0,
}: {
  documentoId: number;
  lineas: Linea[];
  descuentoGlobalPct?: number;
}) {
  const lineas = useSinOcultos(lineasServidor, (l) => `linea:${l.id}`);
  const margenesVisibles = useMargenesVisibles();
  return (
    <Tarjeta disposicion="libre" relleno="ninguno" className="flex flex-col gap-esp3 px-esp4 py-esp4 md:overflow-x-auto md:px-esp6 md:py-esp5">
      <div>
        <h2 className="text-titulo-panel text-texto-primario">Artículos · {lineas.length}</h2>
        {lineas.length > 0 && (
          <p className="text-xs text-texto-terciario">Toca cantidad, precio o descuento para cambiarlos.</p>
        )}
      </div>
      <div className="hidden min-w-[620px] grid-cols-[1fr_80px_100px_70px_100px_24px] gap-esp3 text-xs font-medium text-texto-terciario md:grid">
        <span>CONCEPTO</span>
        <span className="text-right">CANT.</span>
        <span className="text-right">PRECIO</span>
        <span className="text-right">DTO. %</span>
        <span className="text-right">IMPORTE</span>
        <span />
      </div>
      <div className="flex flex-col divide-y divide-borde-default md:min-w-[620px]">
        {lineas.map((l) => (
          <FilaLinea
            key={`${l.id}-${l.piezas}-${l.precio_unitario}-${l.descuento_pct}-${l.descripcion}-${l.artista ?? ""}-${l.coste_unitario ?? ""}`}
            documentoId={documentoId}
            linea={l}
            descuentoGlobalPct={descuentoGlobalPct}
            margenesVisibles={margenesVisibles}
          />
        ))}
        {lineas.length === 0 && (
          <p className="py-esp4 text-sm text-texto-terciario">Todavía no has añadido ningún artículo.</p>
        )}
      </div>
    </Tarjeta>
  );
}

function FilaLinea({
  documentoId,
  linea,
  descuentoGlobalPct,
  margenesVisibles,
}: {
  documentoId: number;
  linea: Linea;
  descuentoGlobalPct: number;
  margenesVisibles: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState(linea.descripcion);
  const [piezas, setPiezas] = useState(texto(linea.piezas, 3));
  const [precio, setPrecio] = useState(texto(linea.precio_unitario, 4));
  const [descuento, setDescuento] = useState(texto(linea.descuento_pct));
  const [artista, setArtista] = useState(linea.artista ?? "");
  const [coste, setCoste] = useState(linea.coste_unitario == null ? "" : texto(linea.coste_unitario, 4));
  const margen = margenLinea(linea, descuentoGlobalPct);

  function guardar(cambios: Parameters<typeof actualizarLinea>[2]) {
    setError(null);
    iniciar(async () => {
      try {
        await desenvolver(actualizarLinea(documentoId, linea.id, cambios));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  function confirmarNumero(valor: string, original: number, campo: "piezas" | "precio_unitario" | "descuento_pct", restaurar: () => void) {
    const n = campo === "descuento_pct" && valor.trim() === "" ? 0 : num(valor);
    if (!Number.isFinite(n)) return restaurar();
    if (Math.abs(n - original) < 0.00005) return;
    guardar({ [campo]: n });
  }

  const celda =
    "h-11 w-full rounded-lg border border-borde-campo bg-fondo-superficie px-esp2 text-right text-base text-texto-primario outline-none focus:border-borde-foco md:h-8 md:border-transparent md:bg-transparent md:text-sm md:hover:border-borde-default md:focus:bg-fondo-superficie";
  const etiquetaMovil = "text-micro text-texto-terciario md:hidden";
  const alPulsarEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    <div className={cn("flex flex-col py-esp3 md:py-esp2", pendiente && "opacity-60")}>
      <div className="grid grid-cols-3 items-end gap-esp2 md:grid-cols-[1fr_80px_100px_70px_100px_24px] md:items-center md:gap-esp3">
        <div className="col-span-3 min-w-0 md:col-span-1">
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            onBlur={() => {
              if (!descripcion.trim()) return setDescripcion(linea.descripcion);
              if (descripcion !== linea.descripcion) guardar({ descripcion: descripcion.trim() });
            }}
            onKeyDown={alPulsarEnter}
            aria-label="Concepto"
            title={descripcion}
            className={cn(celda, "text-left font-medium")}
          />
          <input
            value={artista}
            onChange={(e) => setArtista(e.target.value)}
            onBlur={() => {
              if (artista.trim() !== (linea.artista ?? "")) guardar({ artista });
            }}
            onKeyDown={alPulsarEnter}
            placeholder="+ Artista / referencia"
            aria-label="Artista"
            className="mt-1 h-11 w-full rounded-lg border border-borde-campo bg-fondo-superficie px-esp2 text-left text-base text-texto-secundario outline-none placeholder:text-texto-terciario focus:border-borde-foco md:mt-0 md:h-7 md:border-transparent md:bg-transparent md:text-xs md:hover:border-borde-default md:focus:bg-fondo-superficie"
          />
          {linea.cantidad !== linea.piezas && (
            <p className="px-esp2 text-xs text-texto-terciario">
              {texto(linea.piezas, 3)} ud → {texto(linea.cantidad, 3)} {UNIDAD[linea.unidad] ?? linea.unidad}
            </p>
          )}
        </div>
        <label className="flex flex-col gap-0.5">
          <span className={etiquetaMovil}>Cant.</span>
          <input
            value={piezas}
            onChange={(e) => setPiezas(e.target.value)}
            onBlur={() => confirmarNumero(piezas, linea.piezas, "piezas", () => setPiezas(texto(linea.piezas, 3)))}
            onKeyDown={alPulsarEnter}
            inputMode="decimal"
            enterKeyHint="done"
            aria-label="Cantidad"
            className={celda}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={etiquetaMovil}>Precio €</span>
          <input
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            onBlur={() =>
              confirmarNumero(precio, linea.precio_unitario, "precio_unitario", () =>
                setPrecio(texto(linea.precio_unitario, 4)),
              )
            }
            onKeyDown={alPulsarEnter}
            inputMode="decimal"
            enterKeyHint="done"
            aria-label="Precio unitario"
            className={celda}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={etiquetaMovil}>Dto. %</span>
          <input
            value={descuento}
            onChange={(e) => setDescuento(e.target.value)}
            onBlur={() =>
              confirmarNumero(descuento, linea.descuento_pct, "descuento_pct", () =>
                setDescuento(texto(linea.descuento_pct)),
              )
            }
            onKeyDown={alPulsarEnter}
            inputMode="decimal"
            enterKeyHint="done"
            aria-label="Descuento"
            className={celda}
          />
        </label>
        <span className="col-span-2 flex items-center justify-between pt-esp1 text-right text-base font-semibold text-texto-primario md:col-span-1 md:justify-end md:pt-0 md:text-sm md:font-medium">
          <span className="text-xs font-normal text-texto-terciario md:hidden">Importe</span>
          {euros(linea.importe)}
        </span>
        <button
          disabled={pendiente}
          onClick={async () => {
            if (!(await confirmar(`¿Eliminar «${linea.descripcion}» del documento?`))) return;
            if (await eliminarOptimista(`linea:${linea.id}`, () => desenvolver(eliminarLinea(documentoId, linea.id)))) {
              router.refresh();
            }
          }}
          aria-label="Eliminar línea"
          className="flex h-11 w-11 items-center justify-center justify-self-end text-icono-secundario hover:text-texto-peligro disabled:opacity-50 md:h-6 md:w-6"
        >
          <Icono nombre="eliminar" size={16} />
        </button>
      </div>
      {margenesVisibles && (
        <div className="mt-esp1 flex flex-wrap items-center gap-x-esp3 gap-y-1 rounded-md bg-fondo-sutil/70 px-esp2 py-1 text-xs text-texto-secundario">
          <label className="flex items-center gap-esp1">
            Coste {UNIDAD[linea.unidad] ? `€/${UNIDAD[linea.unidad]}` : "€"}
            <input
              value={coste}
              onChange={(e) => setCoste(e.target.value)}
              onBlur={() => {
                const original = linea.coste_unitario;
                if (coste.trim() === "") {
                  if (original != null) guardar({ coste_unitario: null });
                  return;
                }
                const n = num(coste);
                if (!Number.isFinite(n) || n < 0) {
                  return setCoste(original == null ? "" : texto(original, 4));
                }
                if (original == null || Math.abs(n - original) >= 0.00005) guardar({ coste_unitario: n });
              }}
              onKeyDown={alPulsarEnter}
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="Sin coste"
              aria-label="Coste interno unitario"
              className="h-9 w-24 rounded-md border border-borde-campo bg-fondo-superficie px-esp2 text-right text-sm text-texto-primario outline-none placeholder:text-texto-terciario focus:border-borde-foco md:h-7 md:text-xs"
            />
          </label>
          {margen ? (
            <>
              <span className="tabular-nums">Coste {euros(margen.coste)}</span>
              <span className="tabular-nums">
                Beneficio <strong className="font-medium text-texto-primario">{euros(margen.beneficio)}</strong>
              </span>
              <InsigniaMargen pct={margen.pct} />
            </>
          ) : (
            <InsigniaMargen pct={null} />
          )}
        </div>
      )}
      {error && <p className="px-esp2 text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
