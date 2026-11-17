"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { MapaSelector, type Posicion } from "@/components/mapa/mapa-selector";
import { SafeMapContainer } from "@/components/shared/SafeMapContainer";
import { BuscadorDireccion, type Sugerencia } from "@/components/mapa/buscador-direccion";
import { ALTURA_MAPA_GRANDE } from "@/components/mapa/config-mapa";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { cn } from "@/lib/cn";
import { desenvolver } from "@/lib/accion";
import { ETIQUETA_SOPORTE } from "@/lib/etiquetas";
import { guardarPunto } from "./acciones";

export type PuntoEditable = {
  id: number;
  linea_id: number | null;
  nombre: string;
  tipo_soporte: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  piezas: number | null;
  fecha_colocacion_prevista: string | null;
  fecha_retirada_prevista: string | null;
  notas: string | null;
};


const area =
  "rounded-md border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm";

/**
 * Alta o edición de un punto de la campaña, desde la propia ficha de la campaña
 * (no hace falta que exista un documento en borrador).
 */
const formatoPiezas = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

/** Artículo de un documento de la campaña, con las piezas ya repartidas entre sus puntos. */
export type ArticuloPunto = {
  id: number;
  etiqueta: string;
  documento: string;
  piezas: number;
  repartidas: number;
};

export function FormularioPunto({
  campanaId,
  articulos,
  punto,
  fechasCampana,
  otrosPuntos,
  desdeMapa,
  onCerrar,
}: {
  campanaId: number;
  /** Artículos de los presupuestos/facturas de la campaña. Si hay, el punto debe pertenecer a uno. */
  articulos: ArticuloPunto[];
  /** Si viene, se edita ese punto; si no, se crea uno nuevo. */
  punto?: PuntoEditable;
  fechasCampana: { inicio: string | null; fin: string | null };
  otrosPuntos: { id: number; nombre: string; latitud: number; longitud: number }[];
  /** Posición elegida con pulsación larga en el mapa de la campaña (`version` cambia en cada elección). */
  desdeMapa?: { posicion: Posicion; version: number } | null;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  const [posicion, setPosicion] = useState<Posicion | null>(
    punto ? { latitud: punto.latitud, longitud: punto.longitud } : (desdeMapa?.posicion ?? null),
  );
  const [nombre, setNombre] = useState(punto?.nombre ?? "");
  const [tipo, setTipo] = useState(punto?.tipo_soporte ?? "cartel");
  const [lineaId, setLineaId] = useState<number | null>(
    punto?.linea_id ?? (articulos.length === 1 ? articulos[0]!.id : null),
  );
  const [direccion, setDireccion] = useState(punto?.direccion ?? "");
  const [piezas, setPiezas] = useState(punto?.piezas != null ? String(punto.piezas).replace(".", ",") : "");
  const [colocacion, setColocacion] = useState(punto ? (punto.fecha_colocacion_prevista ?? "") : (fechasCampana.inicio ?? ""));
  const [retirada, setRetirada] = useState(punto ? (punto.fecha_retirada_prevista ?? "") : (fechasCampana.fin ?? ""));
  const [instrucciones, setInstrucciones] = useState(punto?.notas ?? "");
  // Al elegir una sugerencia: se coloca el punto, se rellena la dirección y, si aún no tiene nombre, se propone uno.
  function elegirBusqueda(sugerencia: Sugerencia) {
    setPosicion({ latitud: sugerencia.latitud, longitud: sugerencia.longitud });
    setDireccion(sugerencia.direccion);
    setNombre((actual) => (actual.trim() ? actual : sugerencia.titulo));
    setError(null);
  }

  async function direccionDe(p: Posicion) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&accept-language=es&lat=${p.latitud}&lon=${p.longitud}`,
      );
      const d = (await r.json()) as { display_name?: string; address?: Record<string, string> };
      const a = d.address ?? {};
      const calle = [a.road ?? a.pedestrian ?? a.square, a.house_number].filter(Boolean).join(" ");
      const ciudad = a.city ?? a.town ?? a.village ?? a.municipality;
      return [calle, ciudad].filter(Boolean).join(", ") || d.display_name || "";
    } catch {
      return "";
    }
  }

  function elegirEnMapa(p: Posicion) {
    setPosicion(p);
    // Con el mapa a ancho completo el formulario queda debajo: se acerca (solo en tablet/desktop estrecho, no dentro del modal móvil).
    if (window.matchMedia("(min-width: 768px) and (max-width: 1279px)").matches) {
      setTimeout(() => formulario.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
    void direccionDe(p).then((d) => {
      if (d && !direccion.trim()) setDireccion(d);
    });
  }

  // Posición elegida en el mapa general de la campaña: se coloca el punto y se propone la dirección.
  useEffect(() => {
    if (!desdeMapa) return;
    let vigente = true;
    setPosicion(desdeMapa.posicion);
    setError(null);
    void direccionDe(desdeMapa.posicion).then((d) => {
      if (vigente && d) setDireccion(d);
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desdeMapa?.version]);

  // Contador de piezas del artículo elegido: lo ya repartido en otros puntos + lo que se escribe aquí.
  const articuloElegido = articulos.find((a) => a.id === lineaId) ?? null;
  const propias = punto && punto.linea_id === lineaId ? (punto.piezas ?? 0) : 0;
  const estas = Number(piezas.replace(",", ".")) || 0;
  const restantes = articuloElegido ? articuloElegido.piezas - (articuloElegido.repartidas - propias) - estas : 0;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!posicion) return setError("Primero marca la ubicación en el mapa o busca la dirección.");
    if (articulos.length > 0 && lineaId == null) return setError("Elige a qué artículo del presupuesto o de la factura corresponde el punto.");
    const nPiezas = piezas.trim() === "" ? null : Number(piezas.replace(",", "."));
    iniciar(async () => {
      try {
        await desenvolver(
          guardarPunto(campanaId, punto?.id ?? null, {
            nombre,
            tipoSoporte: tipo,
            lineaId,
            direccion,
            latitud: posicion.latitud,
            longitud: posicion.longitud,
            piezas: nPiezas,
            fechaColocacion: colocacion,
            fechaRetirada: retirada,
            instrucciones,
          }),
        );
        router.refresh();
        onCerrar();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar el punto.");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-esp4 rounded-lg border border-borde-foco bg-fondo-superficie p-esp4 xl:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-esp2">
        <BuscadorDireccion onElegir={elegirBusqueda} />
        <SafeMapContainer
          title={punto ? `Ubicación · ${punto.nombre}` : "Elige la ubicación del punto"}
        >
          <MapaSelector
            puntos={otrosPuntos.filter((p) => p.id !== punto?.id).map((p) => ({ ...p }))}
            posicion={posicion}
            onElegir={elegirEnMapa}
            altura={ALTURA_MAPA_GRANDE}
          />
        </SafeMapContainer>
        <p className="text-xs text-texto-terciario">
          Haz clic en el mapa para {punto ? "mover" : "colocar"} el punto; puedes arrastrarlo para ajustarlo.
        </p>
      </div>

      <form ref={formulario} onSubmit={guardar} className="flex scroll-mt-esp3 flex-col gap-esp3">
        <h3 className="text-base font-semibold text-texto-primario">{punto ? "Editar punto" : "Nuevo punto"}</h3>
        <p className={cn("text-xs", posicion ? "text-texto-exito" : "text-texto-terciario")}>
          {posicion
            ? `Ubicación: ${posicion.latitud.toFixed(5)}, ${posicion.longitud.toFixed(5)}`
            : "Sin ubicación: márcala en el mapa o busca la dirección."}
        </p>
        <Campo texto="Nombre del punto *">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Farola Av. Andalucía 12"
            className={CAMPO}
          />
        </Campo>
        {articulos.length > 0 ? (
          <>
            <Campo texto="Artículo *">
              <select
                value={lineaId ?? ""}
                onChange={(e) => setLineaId(e.target.value ? Number(e.target.value) : null)}
                className={CAMPO}
              >
                <option value="">Elige un artículo…</option>
                {articulos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo texto="Piezas de este punto">
              <input value={piezas} onChange={(e) => setPiezas(e.target.value)} inputMode="decimal" className={CAMPO} />
              {articuloElegido && (
                <span className={restantes < 0 ? "text-xs text-texto-aviso" : "text-xs text-texto-terciario"} role="status">
                  {restantes < 0
                    ? `Con este punto te pasas ${formatoPiezas(-restantes)} del total (${formatoPiezas(articuloElegido.piezas)}). Puedes guardarlo igualmente.`
                    : restantes === 0
                      ? `Con este punto se reparte todo el artículo (${formatoPiezas(articuloElegido.piezas)}).`
                      : `Quedan ${formatoPiezas(restantes)} de ${formatoPiezas(articuloElegido.piezas)}`}
                </span>
              )}
            </Campo>
          </>
        ) : (
          <>
            <p className="rounded-md bg-fondo-aviso-sutil px-esp3 py-esp2 text-xs text-texto-primario">
              Esta campaña no tiene presupuesto ni factura vinculados. Vincula uno desde el documento para elegir entre
              sus artículos; mientras, indica el soporte a mano.
            </p>
            <div className="grid grid-cols-2 gap-esp3">
              <Campo texto="Soporte">
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO}>
                  {Object.entries(ETIQUETA_SOPORTE).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo texto="Piezas">
                <input value={piezas} onChange={(e) => setPiezas(e.target.value)} inputMode="decimal" className={CAMPO} />
              </Campo>
            </div>
          </>
        )}
        <Campo texto="Dirección">
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={CAMPO} />
        </Campo>
        <div className="grid grid-cols-2 gap-esp3">
          <Campo texto="Colocar el">
            <input type="date" value={colocacion} onChange={(e) => setColocacion(e.target.value)} className={CAMPO} />
          </Campo>
          <Campo texto="Retirar el">
            <input
              type="date"
              value={retirada}
              min={colocacion || undefined}
              onChange={(e) => setRetirada(e.target.value)}
              className={CAMPO}
            />
          </Campo>
        </div>
        <Campo texto="Cómo instalar (lo verá el instalador)">
          <textarea
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            rows={3}
            placeholder="Ej. 2 carteles 70x100 con bridas, cara hacia la rotonda"
            className={area}
          />
        </Campo>
        {error && <p className="text-xs text-texto-peligro">{error}</p>}
        <div className="flex gap-esp2">
          <Boton type="submit" className="min-h-11 flex-1" cargando={pendiente}>
            {punto ? "Guardar cambios" : "Añadir punto"}
          </Boton>
          <Boton type="button" variante="secundario" className="min-h-11" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Boton>
        </div>
      </form>
    </div>
  );
}

function Campo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-texto-secundario">{texto}</span>
      {children}
    </label>
  );
}
