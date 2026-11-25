import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { MapaPuntos } from "@/components/mapa/mapa-puntos";
import { SafeMapContainer } from "@/components/shared/SafeMapContainer";
import { ALTURA_MAPA_MEDIA } from "@/components/mapa/config-mapa";
import { Logo } from "@/components/ui/logo";
import { ETIQUETA_SOPORTE, etiquetaEstado } from "@/lib/etiquetas";
import { hoyEnEspana } from "@/lib/estado-cuenta";
import { fechaMedia } from "@/lib/formato";
import {
  esGeometriaZona,
  esTipoUbicacion,
  etiquetaTipoUbicacion,
  type FotoMapa,
  type TipoUbicacion,
} from "@/lib/mapa/zonas";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type FilaGenerada = Database["public"]["Functions"]["obtener_campana_publica_v2"]["Returns"][number];
/** Fila real de obtener_campana_publica_v2: los campos del punto llegan a null si la campaña no tiene puntos. */
type FilaCampanaPublica = Omit<
  FilaGenerada,
  "punto_id" | "punto_nombre" | "punto_estado" | "tipo_soporte" | "direccion" | "latitud" | "longitud"
> & {
  punto_id: number | null;
  punto_nombre: string | null;
  punto_estado: FilaGenerada["punto_estado"] | null;
  tipo_soporte: FilaGenerada["tipo_soporte"] | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
};

function mensajeCabeceraCliente(datos: {
  estado: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  puntosTotales: number;
  puntosCompletados: number;
}): { texto: string; colorPunto: string } | null {
  if (datos.estado === "cancelada") return null;

  const hoy = hoyEnEspana();
  const terminadaPorFecha =
    Boolean(datos.fechaFin && hoy > datos.fechaFin) &&
    (datos.puntosTotales === 0 || datos.puntosCompletados >= datos.puntosTotales);

  if (datos.estado === "finalizada" || terminadaPorFecha) {
    return {
      texto: "Ha sido un placer hacer brillar su campaña",
      colorPunto: "bg-texto-exito",
    };
  }

  const antesDeInicio =
    Boolean(datos.fechaInicio && hoy < datos.fechaInicio) &&
    datos.puntosCompletados === 0;

  if ((datos.estado === "planificada" && datos.puntosCompletados === 0) || antesDeInicio) {
    return {
      texto: "Estamos preparando su campaña con todo detalle",
      colorPunto: "bg-fondo-marca",
    };
  }

  return {
    texto: "Estamos en marcha, dando vida a su campaña",
    colorPunto: "bg-texto-exito",
  };
}

export default async function PaginaPublicaCliente({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // Estas dos llamadas usan funciones SECURITY DEFINER (ver
  // schema_campanas.sql): funcionan sin sesión, llamadas con el rol anon.
  const [{ data: filas }, { data: fotos }] = await Promise.all([
    supabase.rpc("obtener_campana_publica_v2", { p_token: token }),
    supabase.rpc("obtener_fotos_publicas", { p_token: token }),
  ]);

  if (!filas || filas.length === 0) notFound();

  // Se registra la vista en segundo plano (no bloquea el render).
  supabase.rpc("registrar_vista_enlace", { p_token: token }).then(() => {});

  const cabecera = filas[0];
  if (!cabecera) notFound();
  // La función SQL hace LEFT JOIN: una campaña sin puntos devuelve una sola fila con los campos
  // del punto a null (los tipos generados no lo reflejan). Esa fila solo sirve de cabecera.
  const puntos = (filas as FilaCampanaPublica[])
    // Con punto_id, la fila es un punto real: sus campos obligatorios vienen rellenos.
    .filter((p): p is FilaGenerada => p.punto_id != null)
    // La función SQL no garantiza orden: se muestran siempre en el mismo orden de alta.
    .sort((a, b) => a.punto_id - b.punto_id);
  const fotosPorPunto = new Map<number, typeof fotos>();
  for (const f of fotos ?? []) {
    const lista = fotosPorPunto.get(f.punto_id) ?? [];
    lista.push(f);
    fotosPorPunto.set(f.punto_id, lista);
  }

  const puntosTotales = puntos.length;
  const puntosCompletados = puntos.filter((p) =>
    ["instalado", "verificado", "retirado"].includes(p.punto_estado ?? ""),
  ).length;
  const totalFotos = (fotos ?? []).length;
  const fotosParaMapa: FotoMapa[] = (fotos ?? []).flatMap((f) => {
    if (f.latitud == null || f.longitud == null) return [];
    return [
      {
        id: f.url_foto,
        puntoId: f.punto_id,
        puntoNombre: f.punto_nombre ?? undefined,
        url: `/c/${encodeURIComponent(token)}/foto?ruta=${encodeURIComponent(f.url_foto)}`,
        latitud: Number(f.latitud),
        longitud: Number(f.longitud),
        tomadaEn: f.tomada_en,
        tipo: f.tipo,
        origenUbicacion: f.origen_ubicacion,
      },
    ];
  });
  const primerPunto = puntos.find((p) => p.latitud != null && p.longitud != null);
  const mensajeCliente = mensajeCabeceraCliente({
    estado: cabecera.campana_estado,
    fechaInicio: cabecera.fecha_inicio,
    fechaFin: cabecera.fecha_fin,
    puntosTotales,
    puntosCompletados,
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-esp5 bg-fondo-lienzo px-esp4 py-esp6 sm:py-esp8">
      <header className="flex flex-wrap items-center justify-between gap-x-esp4 gap-y-esp2">
        <Logo alto={40} className="shrink-0" />
        {mensajeCliente && (
          <p className="inline-flex items-center gap-esp2 rounded-completo border border-borde-default bg-fondo-superficie px-esp3 py-1.5 text-xs font-medium text-texto-secundario">
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-completo ${mensajeCliente.colorPunto}`} />
            <span>{mensajeCliente.texto}</span>
          </p>
        )}
      </header>

      <section className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 sm:p-esp5">
        <div className="flex flex-wrap items-start justify-between gap-esp2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-texto-terciario">
              {cabecera.cliente_nombre}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold text-texto-primario sm:text-titulo-pagina">
              {cabecera.campana_nombre}
            </h1>
            <p className="mt-0.5 text-xs text-texto-secundario">
              {cabecera.fecha_inicio && cabecera.fecha_fin
                ? `${fechaMedia(cabecera.fecha_inicio)} — ${fechaMedia(cabecera.fecha_fin)}`
                : cabecera.fecha_inicio
                  ? `Desde el ${fechaMedia(cabecera.fecha_inicio)}`
                  : ""}
            </p>
          </div>
          {cabecera.campana_estado && (
            <Insignia tono={TONO_POR_ESTADO[cabecera.campana_estado] ?? "neutro"}>
              {etiquetaEstado(cabecera.campana_estado)}
            </Insignia>
          )}
        </div>

        <div className="grid grid-cols-3 gap-esp2 border-t border-borde-default pt-esp3">
          <div className="rounded-md bg-fondo-sutil/70 px-esp3 py-esp2">
            <p className="text-micro text-texto-terciario">Puntos</p>
            <p className="tabular-nums text-lg font-semibold text-texto-primario">{puntosTotales}</p>
          </div>
          <div className="rounded-md bg-fondo-sutil/70 px-esp3 py-esp2">
            <p className="text-micro text-texto-terciario">Instalados</p>
            <p className="tabular-nums text-lg font-semibold text-texto-exito">
              {puntosCompletados}/{puntosTotales}
            </p>
          </div>
          <div className="rounded-md bg-fondo-sutil/70 px-esp3 py-esp2">
            <p className="text-micro text-texto-terciario">Fotos</p>
            <p className="tabular-nums text-lg font-semibold text-texto-primario">{totalFotos}</p>
          </div>
        </div>
      </section>

      <SafeMapContainer
        title={cabecera.campana_nombre ?? "Mapa de la campaña"}
        coordinates={
          primerPunto && primerPunto.latitud != null && primerPunto.longitud != null
            ? { lat: primerPunto.latitud, lng: primerPunto.longitud }
            : null
        }
        address={primerPunto?.direccion ?? null}
      >
        <MapaPuntos
          puntos={puntos
            .filter((p) => p.latitud != null && p.longitud != null)
            .map((p) => ({
              id: p.punto_id,
              nombre: p.punto_nombre ?? "Punto",
              latitud: Number(p.latitud!),
              longitud: Number(p.longitud!),
              estado:
                p.punto_estado === "incidencia"
                  ? "pendiente"
                  : (p.punto_estado ?? undefined),
              direccion: p.direccion,
              tipo_ubicacion: esTipoUbicacion(p.tipo_ubicacion) ? p.tipo_ubicacion : ("punto" as TipoUbicacion),
              radio_metros: p.radio_metros == null ? null : Number(p.radio_metros),
              geometria: esGeometriaZona(p.geometria) ? p.geometria : null,
            }))}
          fotos={fotosParaMapa}
          altura={ALTURA_MAPA_MEDIA}
        />
      </SafeMapContainer>

      <div className="flex flex-col gap-esp4">
        {puntos.map((p) => (
          <div
            key={p.punto_id}
            className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 sm:p-esp5"
          >
            <div className="flex items-start gap-esp3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-esp2">
                  <p className="font-medium text-texto-primario">{p.punto_nombre}</p>
                  {etiquetaTipoUbicacion(p.tipo_ubicacion, p.radio_metros, p.direccion) && (
                    <span className="rounded bg-fondo-marca-sutil px-1.5 py-0.5 text-micro font-medium text-texto-marca">
                      {etiquetaTipoUbicacion(p.tipo_ubicacion, p.radio_metros, p.direccion)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-texto-terciario">
                  {ETIQUETA_SOPORTE[p.tipo_soporte] ?? p.tipo_soporte}
                  {p.direccion ? ` · ${p.direccion}` : ""}
                </p>
                {p.latitud != null && p.longitud != null && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${p.latitud},${p.longitud}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-texto-marca hover:underline"
                  >
                    <Icono nombre="ubicacion" size={12} />
                    Ver en Google Maps
                  </a>
                )}
              </div>
              <Insignia tono={TONO_POR_ESTADO[p.punto_estado === "incidencia" ? "pendiente" : p.punto_estado] ?? "neutro"}>
                {etiquetaEstado(p.punto_estado === "incidencia" ? "pendiente" : p.punto_estado)}
              </Insignia>
            </div>
            {(fotosPorPunto.get(p.punto_id) ?? []).length > 0 && (
              // f.url_foto es la ruta dentro del bucket privado "fotos-puntos".
              // Se sirve a través de /c/[token]/foto, que comprueba el token y
              // firma la URL en el servidor (ver foto/route.ts).
              <div className="grid grid-cols-2 gap-esp3 border-t border-fondo-hover pt-esp3 sm:grid-cols-3">
                {(fotosPorPunto.get(p.punto_id) ?? []).map((f) => {
                  const src = `/c/${encodeURIComponent(token)}/foto?ruta=${encodeURIComponent(f.url_foto)}`;
                  const conUbicacion = f.latitud != null && f.longitud != null;
                  return (
                    <div key={f.url_foto} className="flex flex-col gap-1">
                      <a href={src} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Foto de ${p.punto_nombre ?? "punto"}`}
                          loading="lazy"
                          className="aspect-square w-full rounded-md bg-fondo-sutil object-cover"
                        />
                      </a>
                      <p className="tabular-nums text-xs text-texto-terciario">
                        {new Intl.DateTimeFormat("es-ES", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(f.tomada_en))}
                      </p>
                      {conUbicacion && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${f.latitud},${f.longitud}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-texto-exito hover:underline"
                        >
                          {f.origen_ubicacion === "gps_al_subir"
                            ? "📍 Ubicación al subir la foto"
                            : "📍 Ver ubicación de la foto"}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-texto-terciario">
        Enlace proporcionado por Creativa · sin necesidad de iniciar sesión
      </p>
    </main>
  );
}
