"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { subirFotoPunto, marcarPuntoInstalado, reportarIncidencia } from "./acciones";

const ETIQUETA_SOPORTE: Record<string, string> = {
  valla: "Valla",
  totem: "Tótem",
  lona: "Lona",
  cartel: "Cartel",
  mobiliario_urbano: "Mobiliario urbano",
  marquesina: "Marquesina",
  pantalla: "Pantalla",
  otro: "Soporte",
};

type Punto = {
  id: number;
  nombre: string;
  tipo_soporte: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  estado: string;
  notas: string | null;
  campanas: { nombre: string } | { nombre: string }[] | null;
};

type Foto = { id: number; tipo: string; url: string | null; tomada_en: string };

export function PanelPunto({
  punto,
  asignacion,
  fotos,
}: {
  punto: Punto;
  asignacion: { id: number; estado: string } | null;
  fotos: Foto[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendiente, iniciar] = useTransition();
  const [mostrarIncidencia, setMostrarIncidencia] = useState(false);
  const [notaIncidencia, setNotaIncidencia] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  const campana = Array.isArray(punto.campanas) ? punto.campanas[0] : punto.campanas;

  function obtenerUbicacion(): Promise<GeolocationPosition | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });
  }

  async function onArchivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);

    const posicion = await obtenerUbicacion();
    const formData = new FormData();
    formData.set("archivo", archivo);
    formData.set("puntoId", String(punto.id));
    if (asignacion) formData.set("asignacionId", String(asignacion.id));
    formData.set("tipo", "instalacion");
    if (posicion) {
      formData.set("latitud", String(posicion.coords.latitude));
      formData.set("longitud", String(posicion.coords.longitude));
    }

    await subirFotoPunto(formData);
    setSubiendo(false);
    router.refresh();
  }

  function completar() {
    if (!asignacion) return;
    iniciar(async () => {
      await marcarPuntoInstalado(punto.id, asignacion.id);
      router.refresh();
    });
  }

  function enviarIncidencia() {
    iniciar(async () => {
      await reportarIncidencia(punto.id, notaIncidencia);
      setMostrarIncidencia(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <div className="flex items-start gap-esp3">
        <button onClick={() => router.back()} className="mt-1 text-icono-secundario">
          <Icono nombre="atras" size={22} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-texto-primario">{punto.nombre}</h1>
          <p className="text-sm text-texto-terciario">
            {ETIQUETA_SOPORTE[punto.tipo_soporte] ?? punto.tipo_soporte} · {campana?.nombre}
          </p>
        </div>
        <Insignia tono={TONO_POR_ESTADO[punto.estado] ?? "neutro"}>{punto.estado}</Insignia>
      </div>

      {punto.direccion && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${punto.latitud},${punto.longitud}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-esp2 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3 text-sm text-texto-primario"
        >
          <Icono nombre="ubicacion" size={18} className="text-icono-marca" />
          {punto.direccion}
        </a>
      )}

      {punto.notas && punto.estado === "incidencia" && (
        <div className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp4 py-esp3">
          <p className="text-xs font-medium text-texto-peligro">INCIDENCIA REPORTADA</p>
          <p className="text-sm text-texto-primario">{punto.notas}</p>
        </div>
      )}

      {/* Fotos */}
      <div className="flex flex-col gap-esp3">
        <div className="flex items-center">
          <h2 className="flex-1 text-sm font-medium text-texto-secundario">
            Fotos · {fotos.length}
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-esp2">
          {fotos.map((f) =>
            f.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f.id}
                src={f.url}
                alt={f.tipo}
                className="aspect-square w-full rounded-md object-cover"
              />
            ) : null,
          )}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-borde-fuerte text-texto-terciario disabled:opacity-50"
          >
            <Icono nombre="camara" size={22} />
            <span className="text-xs">{subiendo ? "Subiendo…" : "Añadir"}</span>
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onArchivoSeleccionado}
        />
      </div>

      {/* Acciones */}
      {asignacion && asignacion.estado !== "completada" && (
        <div className="flex flex-col gap-esp2">
          <Boton onClick={completar} cargando={pendiente} disabled={fotos.length === 0}>
            Marcar como instalado
          </Boton>
          {fotos.length === 0 && (
            <p className="text-center text-xs text-texto-terciario">
              Sube al menos una foto antes de marcarlo como instalado.
            </p>
          )}
          <Boton variante="fantasma" onClick={() => setMostrarIncidencia((v) => !v)}>
            Reportar incidencia
          </Boton>
        </div>
      )}

      {mostrarIncidencia && (
        <div className="flex flex-col gap-esp2 rounded-lg border border-borde-default bg-fondo-superficie p-esp4">
          <textarea
            value={notaIncidencia}
            onChange={(e) => setNotaIncidencia(e.target.value)}
            placeholder="¿Qué ha pasado?"
            rows={3}
            className="rounded-md border border-borde-fuerte px-esp3 py-esp2 text-sm outline-none focus:border-borde-foco"
          />
          <Boton variante="peligro" onClick={enviarIncidencia} cargando={pendiente} disabled={!notaIncidencia}>
            Enviar incidencia
          </Boton>
        </div>
      )}
    </div>
  );
}
