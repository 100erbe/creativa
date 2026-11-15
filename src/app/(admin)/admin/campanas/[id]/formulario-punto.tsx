"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { MapaSelector, type Posicion } from "@/components/mapa/mapa-selector";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { cn } from "@/lib/cn";
import { desenvolver } from "@/lib/accion";
import { ETIQUETA_SOPORTE } from "@/lib/etiquetas";
import { guardarPunto } from "./acciones";

export type PuntoEditable = {
  id: number;
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

type ResultadoBusqueda = { display_name: string; lat: string; lon: string };

const area =
  "rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm";

/**
 * Alta o edición de un punto de la campaña, desde la propia ficha de la campaña
 * (no hace falta que exista un documento en borrador).
 */
export function FormularioPunto({
  campanaId,
  punto,
  fechasCampana,
  otrosPuntos,
  onCerrar,
}: {
  campanaId: number;
  /** Si viene, se edita ese punto; si no, se crea uno nuevo. */
  punto?: PuntoEditable;
  fechasCampana: { inicio: string | null; fin: string | null };
  otrosPuntos: { id: number; nombre: string; latitud: number; longitud: number }[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  const [posicion, setPosicion] = useState<Posicion | null>(
    punto ? { latitud: punto.latitud, longitud: punto.longitud } : null,
  );
  const [nombre, setNombre] = useState(punto?.nombre ?? "");
  const [tipo, setTipo] = useState(punto?.tipo_soporte ?? "cartel");
  const [direccion, setDireccion] = useState(punto?.direccion ?? "");
  const [piezas, setPiezas] = useState(punto?.piezas != null ? String(punto.piezas).replace(".", ",") : "");
  const [colocacion, setColocacion] = useState(punto ? (punto.fecha_colocacion_prevista ?? "") : (fechasCampana.inicio ?? ""));
  const [retirada, setRetirada] = useState(punto ? (punto.fecha_retirada_prevista ?? "") : (fechasCampana.fin ?? ""));
  const [instrucciones, setInstrucciones] = useState(punto?.notas ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);

  // Geocodificación con Nominatim (OpenStreetMap, gratuito): solo al pulsar "Buscar".
  async function buscar() {
    const q = busqueda.trim();
    if (!q) return;
    setBuscando(true);
    setError(null);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=es&accept-language=es&q=${encodeURIComponent(q)}`,
      );
      const datos = (await r.json()) as ResultadoBusqueda[];
      setResultados(datos);
      if (datos.length === 0) setError("No se ha encontrado esa dirección. Prueba a marcarla en el mapa.");
    } catch {
      setError("No se pudo buscar la dirección. Márcala directamente en el mapa.");
    } finally {
      setBuscando(false);
    }
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
    // Con el mapa a ancho completo el formulario queda debajo: se acerca.
    if (window.matchMedia("(max-width: 1279px)").matches) {
      setTimeout(() => formulario.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
    void direccionDe(p).then((d) => {
      if (d && !direccion.trim()) setDireccion(d);
    });
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!posicion) return setError("Primero marca la ubicación en el mapa o busca la dirección.");
    const nPiezas = piezas.trim() === "" ? null : Number(piezas.replace(",", "."));
    iniciar(async () => {
      try {
        await desenvolver(
          guardarPunto(campanaId, punto?.id ?? null, {
            nombre,
            tipoSoporte: tipo,
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
        <div className="flex gap-esp2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
                void buscar();
              }
            }}
            placeholder="Buscar dirección: Calle Larios 5, Málaga"
            enterKeyHint="search"
            type="search"
            aria-label="Buscar dirección"
            className={CAMPO}
          />
          <Boton type="button" variante="secundario" className="min-h-11 md:min-h-0" onClick={buscar} cargando={buscando}>
            <Icono nombre="buscar" size={16} />
            Buscar
          </Boton>
        </div>
        {resultados.length > 0 && (
          <div className="flex flex-col rounded-md border border-borde-default bg-fondo-superficie">
            {resultados.map((r) => (
              <button
                key={`${r.lat},${r.lon}`}
                type="button"
                onClick={() => {
                  setPosicion({ latitud: Number(r.lat), longitud: Number(r.lon) });
                  setDireccion(r.display_name.split(",").slice(0, 3).join(",").trim());
                  setResultados([]);
                }}
                className="min-h-11 px-esp3 py-esp2 text-left text-sm text-texto-primario hover:bg-fondo-sutil active:bg-fondo-sutil md:text-xs"
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
        <MapaSelector
          puntos={otrosPuntos.filter((p) => p.id !== punto?.id).map((p) => ({ ...p }))}
          posicion={posicion}
          onElegir={elegirEnMapa}
          altura={320}
        />
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
