"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { MapaSelector, type Posicion } from "@/components/mapa/mapa-selector";
import { BarraAccion, CAMPO } from "@/components/ui/panel-busqueda";
import { cn } from "@/lib/cn";
import { ETIQUETA_TIPO } from "@/lib/documentos";
import { fechaMedia } from "@/lib/formato";
import type { Cabecera } from "./paso-lineas";
import { anadirPunto, crearCampana, eliminarPunto, vincularCampana } from "./acciones";
import { desenvolver } from "@/lib/accion";
import { confirmar } from "@/components/ui/dialogos";
import { useAccion } from "@/lib/use-accion";

type Campana = { id: number; nombre: string; fecha_inicio: string | null; fecha_fin: string | null; estado: string };
type Articulo = { id: number; descripcion: string; artista: string | null; piezas: number; unidad: string };
type Punto = {
  id: number;
  nombre: string;
  tipo_soporte: string;
  linea_id: number | null;
  piezas: number | null;
  direccion: string | null;
  latitud: number;
  longitud: number;
  fecha_colocacion_prevista: string | null;
  fecha_retirada_prevista: string | null;
  estado: string;
  notas: string | null;
};

const SOPORTES = [
  { valor: "cartel", etiqueta: "Cartel" },
  { valor: "lona", etiqueta: "Lona" },
  { valor: "valla", etiqueta: "Valla" },
  { valor: "totem", etiqueta: "Tótem" },
  { valor: "mobiliario_urbano", etiqueta: "Mobiliario urbano / farola" },
  { valor: "marquesina", etiqueta: "Marquesina" },
  { valor: "pantalla", etiqueta: "Pantalla" },
  { valor: "otro", etiqueta: "Otro soporte" },
] as const;
const ETIQUETA_SOPORTE = Object.fromEntries(SOPORTES.map((s) => [s.valor, s.etiqueta])) as Record<string, string>;

const entrada = CAMPO;
const areaTexto =
  "rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm";

export function PasoCampana({
  documento,
  campanas,
  articulos,
  puntos,
}: {
  documento: Cabecera;
  campanas: Campana[];
  articulos: Articulo[];
  puntos: Punto[];
}) {
  const router = useRouter();
  const campana = campanas.find((c) => c.id === documento.campana_id) ?? null;
  const etiquetaTipo = ETIQUETA_TIPO[documento.tipo] ?? "Documento";

  return (
    <div className="flex flex-col gap-esp5">
      <div className="flex flex-wrap items-center gap-esp3">
        <div className="flex-1">
          <p className="text-xs text-texto-terciario">Documentos / Nuevo</p>
          <h1 className="text-2xl font-semibold text-texto-primario">{etiquetaTipo} en borrador</h1>
        </div>
        <Link href="/admin/documentos">
          <Boton variante="secundario">Guardar y salir</Boton>
        </Link>
      </div>

      <PasosDocumento actual={3} documentoId={documento.id} />

      <div>
        <h2 className="text-lg font-semibold text-texto-primario">¿Dónde y cómo se hace la campaña?</h2>
        <p className="text-sm text-texto-secundario">
          Marca en el mapa cada punto donde se instalará la publicidad, con el tipo de soporte y las fechas.
          Los instaladores lo verán en su agenda. Si este documento no lleva instalación, puedes saltar este paso.
        </p>
      </div>

      {campana ? (
        <CampanaVinculada documento={documento} campana={campana} articulos={articulos} puntos={puntos} />
      ) : (
        <ElegirCampana documento={documento} campanas={campanas} />
      )}

      <BarraAccion className="md:border-t md:border-borde-default md:pt-esp4">
        <Boton variante="secundario" onClick={() => router.push(`/admin/documentos/nuevo?documento=${documento.id}`)}>
          Atrás
        </Boton>
        <span className="flex-1" />
        {!campana && (
          <Boton variante="fantasma" onClick={() => router.push(`/admin/documentos/${documento.id}`)}>
            Saltar
            <span className="hidden sm:inline">, sin campaña</span>
          </Boton>
        )}
        <Boton onClick={() => router.push(`/admin/documentos/${documento.id}`)}>Continuar</Boton>
      </BarraAccion>
    </div>
  );
}

function ElegirCampana({ documento, campanas }: { documento: Cabecera; campanas: Campana[] }) {
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  const [nombre, setNombre] = useState("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [existente, setExistente] = useState("");

  return (
    <div className="grid grid-cols-1 gap-esp4 lg:grid-cols-[1fr_320px]">
      <form
        className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5"
        onSubmit={(e) => {
          e.preventDefault();
          ejecutar(async () => {
            await desenvolver(crearCampana(documento.id, {
              nombre,
              fecha_inicio: inicio,
              fecha_fin: fin,
              descripcion,
            }));
          });
        }}
      >
        <h3 className="text-base font-semibold text-texto-primario">Nueva campaña</h3>
        <Etiqueta texto="Nombre de la campaña *">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder={`${documento.cliente} · Concierto verano`}
            className={entrada}
          />
        </Etiqueta>
        <div className="grid grid-cols-2 gap-esp3">
          <Etiqueta texto="Inicio (colocación)">
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={entrada} />
          </Etiqueta>
          <Etiqueta texto="Fin (retirada)">
            <input type="date" value={fin} min={inicio || undefined} onChange={(e) => setFin(e.target.value)} className={entrada} />
          </Etiqueta>
        </div>
        <Etiqueta texto="Indicaciones generales">
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            placeholder="Ej. instalar de noche, pedir permiso al ayuntamiento…"
            className={areaTexto}
          />
        </Etiqueta>
        {error && <p className="text-sm text-texto-peligro">{error}</p>}
        <Boton type="submit" cargando={pendiente} className="self-end">
          Crear campaña y marcar puntos
        </Boton>
      </form>

      <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
        <h3 className="text-base font-semibold text-texto-primario">O usar una existente</h3>
        {campanas.length === 0 ? (
          <p className="text-sm text-texto-terciario">Este cliente aún no tiene campañas.</p>
        ) : (
          <>
            <div role="radiogroup" aria-label="Campañas del cliente" className="flex max-h-64 flex-col gap-esp2 overflow-y-auto">
              {campanas.map((c) => {
                const activa = existente === String(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={activa}
                    onClick={() => setExistente(String(c.id))}
                    className={cn(
                      "flex min-h-12 shrink-0 flex-col justify-center rounded-md border px-esp3 py-esp2 text-left",
                      activa
                        ? "border-borde-foco bg-fondo-marca-sutil"
                        : "border-borde-fuerte bg-fondo-superficie hover:bg-fondo-sutil",
                    )}
                  >
                    <span className="text-sm font-medium text-texto-primario">{c.nombre}</span>
                    {c.fecha_inicio && <span className="text-xs text-texto-terciario">{fechaMedia(c.fecha_inicio)}</span>}
                  </button>
                );
              })}
            </div>
            <Boton
              variante="secundario"
              className="min-h-11"
              disabled={!existente || pendiente}
              onClick={() => ejecutar(() => desenvolver(vincularCampana(documento.id, Number(existente))))}
            >
              Vincular
            </Boton>
          </>
        )}
      </div>
    </div>
  );
}

function CampanaVinculada({
  documento,
  campana,
  articulos,
  puntos,
}: {
  documento: Cabecera;
  campana: Campana;
  articulos: Articulo[];
  puntos: Punto[];
}) {
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });

  return (
    <div className="flex flex-col gap-esp4">
      <div className="flex flex-wrap items-center gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-fondo-marca-sutil text-texto-marca">
          <Icono nombre="campanas" size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-texto-primario">{campana.nombre}</p>
          <p className="text-xs text-texto-terciario">
            {campana.fecha_inicio ? fechaMedia(campana.fecha_inicio) : "Sin fecha de inicio"}
            {campana.fecha_fin ? ` → ${fechaMedia(campana.fecha_fin)}` : ""} · {puntos.length}{" "}
            {puntos.length === 1 ? "punto" : "puntos"}
          </p>
        </div>
        <Link href={`/admin/campanas/${campana.id}`} className="text-sm font-medium text-texto-marca">
          Abrir campaña
        </Link>
        <button
          disabled={pendiente}
          onClick={() => ejecutar(() => desenvolver(vincularCampana(documento.id, null)))}
          className="text-sm font-medium text-texto-secundario hover:text-texto-peligro"
        >
          Desvincular
        </button>
      </div>
      {error && <p className="text-sm text-texto-peligro">{error}</p>}

      <NuevoPunto documentoId={documento.id} campana={campana} articulos={articulos} puntos={puntos} />

      <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
        <h3 className="text-base font-semibold text-texto-primario">Puntos de la campaña · {puntos.length}</h3>
        {articulos.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md bg-fondo-sutil px-esp3 py-esp2">
            {articulos.map((a) => {
              const usadas = puntos.filter((p) => p.linea_id === a.id).reduce((t, p) => t + (p.piezas ?? 0), 0);
              return (
                <p key={a.id} className="text-xs text-texto-secundario">
                  <span className="font-medium text-texto-primario">{etiquetaArticulo(a)}</span> · repartidas {usadas}
                  {a.unidad === "ud" ? " de " + a.piezas : ""}
                </p>
              );
            })}
          </div>
        )}
        {puntos.length === 0 && (
          <p className="text-sm text-texto-terciario">Aún no hay puntos. Haz clic en el mapa para añadir el primero.</p>
        )}
        <div className="flex flex-col divide-y divide-fondo-hover">
          {puntos.map((p, i) => (
            <div key={p.id} className="flex items-start gap-esp3 py-esp3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-completo bg-fondo-sutil text-xs font-medium text-texto-secundario">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-texto-primario">
                  {p.nombre}{" "}
                  <span className="font-normal text-texto-terciario">
                    ·{" "}
                    {(() => {
                      const a = articulos.find((x) => x.id === p.linea_id);
                      return a ? etiquetaArticulo(a) : (ETIQUETA_SOPORTE[p.tipo_soporte] ?? p.tipo_soporte);
                    })()}
                    {p.piezas != null ? " · " + p.piezas + " pzs" : ""}
                  </span>
                </p>
                {p.direccion && <p className="truncate text-xs text-texto-secundario">{p.direccion}</p>}
                <p className="text-xs text-texto-terciario">
                  {p.fecha_colocacion_prevista ? `Colocar ${fechaMedia(p.fecha_colocacion_prevista)}` : "Sin fecha"}
                  {p.fecha_retirada_prevista ? ` · retirar ${fechaMedia(p.fecha_retirada_prevista)}` : ""}
                  {p.notas ? ` · ${p.notas}` : ""}
                </p>
              </div>
              {p.estado === "pendiente" ? (
                <button
                  aria-label={`Eliminar ${p.nombre}`}
                  disabled={pendiente}
                  onClick={async () => {
                    if (!(await confirmar(`¿Eliminar el punto «${p.nombre}»?`))) return;
                    ejecutar(() => desenvolver(eliminarPunto(documento.id, campana.id, p.id)));
                  }}
                  className="text-icono-secundario hover:text-texto-peligro disabled:opacity-50"
                >
                  <Icono nombre="eliminar" size={16} />
                </button>
              ) : (
                <span className="text-xs text-texto-terciario">{p.estado}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type ResultadoBusqueda = { display_name: string; lat: string; lon: string };

function etiquetaArticulo(a: Articulo) {
  return a.artista ? `${a.artista} — ${a.descripcion}` : a.descripcion;
}

function NuevoPunto({
  documentoId,
  campana,
  articulos,
  puntos,
}: {
  documentoId: number;
  campana: Campana;
  articulos: Articulo[];
  puntos: Punto[];
}) {
  const { pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const [nombre, setNombre] = useState("");
  const [lineaId, setLineaId] = useState<string>(articulos.length === 1 ? String(articulos[0]!.id) : "");
  const [piezas, setPiezas] = useState("");
  const [direccion, setDireccion] = useState("");
  const [colocacion, setColocacion] = useState(campana.fecha_inicio ?? "");
  const [retirada, setRetirada] = useState(campana.fecha_fin ?? "");
  const [notas, setNotas] = useState("");
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

  const formulario = useRef<HTMLFormElement>(null);
  function elegirEnMapa(p: Posicion) {
    setPosicion(p);
    // En móvil el formulario queda bajo el mapa: lo acercamos.
    if (window.matchMedia("(max-width: 1279px)").matches) {
      setTimeout(() => formulario.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
    void direccionDe(p).then((d) => {
      if (d) setDireccion(d);
    });
  }

  function limpiar() {
    setPosicion(null);
    setNombre("");
    setDireccion("");
    setNotas("");
    setPiezas("");
    setBusqueda("");
    setResultados([]);
  }

  return (
    <div className="grid grid-cols-1 gap-esp4 xl:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-esp2">
        <div className="flex gap-esp2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur(); // esconde el teclado para ver los resultados
                void buscar();
              }
            }}
            placeholder="Buscar dirección: Calle Larios 5, Málaga"
            enterKeyHint="search"
            type="search"
            className={entrada}
          />
          <Boton variante="secundario" className="min-h-11 md:min-h-0" onClick={buscar} cargando={buscando}>
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
          puntos={puntos.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            latitud: p.latitud,
            longitud: p.longitud,
            detalle: ETIQUETA_SOPORTE[p.tipo_soporte],
          }))}
          posicion={posicion}
          onElegir={elegirEnMapa}
        />
        <p className="text-xs text-texto-terciario">
          Haz clic en el mapa para colocar el punto; puedes arrastrarlo para ajustarlo.
        </p>
      </div>

      <form
        ref={formulario}
        className={cn(
          "flex scroll-mt-esp3 flex-col gap-esp3 rounded-lg border bg-fondo-superficie px-esp5 py-esp4",
          posicion ? "border-borde-foco" : "border-borde-default",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          if (!posicion) {
            setError("Primero marca la ubicación en el mapa.");
            return;
          }
          if (articulos.length > 0 && !lineaId) {
            setError("Elige a qué artículo del documento corresponde el punto.");
            return;
          }
          const nPiezas = piezas.trim() === "" ? null : Number(piezas.replace(",", "."));
          ejecutar(async () => {
            await desenvolver(anadirPunto(documentoId, campana.id, {
              nombre,
              lineaId: lineaId ? Number(lineaId) : null,
              piezas: nPiezas,
              direccion,
              latitud: posicion.latitud,
              longitud: posicion.longitud,
              fecha_colocacion_prevista: colocacion,
              fecha_retirada_prevista: retirada,
              notas,
            }));
            limpiar();
          });
        }}
      >
        <h3 className="text-base font-semibold text-texto-primario">Nuevo punto</h3>
        <p className={cn("text-xs", posicion ? "text-texto-exito" : "text-texto-terciario")}>
          {posicion
            ? `Ubicación: ${posicion.latitud.toFixed(5)}, ${posicion.longitud.toFixed(5)}`
            : "Sin ubicación: márcala en el mapa o busca la dirección."}
        </p>
        <Etiqueta texto="Nombre del punto *">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Farola Av. Andalucía 12"
            className={entrada}
          />
        </Etiqueta>
        {articulos.length > 0 ? (
          <div className="flex flex-col gap-esp2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-texto-secundario">Artículo / soporte *</span>
              <div role="radiogroup" aria-label="Artículo" className="flex flex-col gap-esp2">
                {articulos.map((a) => {
                  const activo = lineaId === String(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => setLineaId(String(a.id))}
                      className={cn(
                        "min-h-11 rounded-md border px-esp3 py-esp2 text-left text-sm",
                        activo
                          ? "border-borde-foco bg-fondo-marca-sutil font-medium text-texto-marca"
                          : "border-borde-fuerte bg-fondo-superficie text-texto-primario hover:bg-fondo-sutil",
                      )}
                    >
                      {etiquetaArticulo(a)}
                    </button>
                  );
                })}
              </div>
            </div>
            <Etiqueta texto="Piezas">
              <input value={piezas} onChange={(e) => setPiezas(e.target.value)} inputMode="decimal" className={entrada} />
            </Etiqueta>
          </div>
        ) : (
          <p className="rounded-md bg-fondo-aviso-sutil px-esp3 py-esp2 text-xs text-texto-primario">
            Este documento aún no tiene artículos. Añádelos en el paso 2 para poder asignarlos a los puntos.
          </p>
        )}
        <Etiqueta texto="Dirección">
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={entrada} />
        </Etiqueta>
        <div className="grid grid-cols-2 gap-esp2">
          <Etiqueta texto="Colocar el">
            <input type="date" value={colocacion} onChange={(e) => setColocacion(e.target.value)} className={entrada} />
          </Etiqueta>
          <Etiqueta texto="Retirar el">
            <input
              type="date"
              value={retirada}
              min={colocacion || undefined}
              onChange={(e) => setRetirada(e.target.value)}
              className={entrada}
            />
          </Etiqueta>
        </div>
        <Etiqueta texto="Cómo instalar">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Ej. 2 carteles 70x100 con bridas, cara hacia la rotonda"
            className={areaTexto}
          />
        </Etiqueta>
        {error && <p className="text-xs text-texto-peligro">{error}</p>}
        <Boton type="submit" className="min-h-11" cargando={pendiente} disabled={!posicion}>
          <Icono nombre="ubicacion" size={16} />
          Añadir punto
        </Boton>
      </form>
    </div>
  );
}

function Etiqueta({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-texto-secundario">{texto}</span>
      {children}
    </label>
  );
}
