import Link from "next/link";
import { BotonAvisos } from "@/components/ui/boton-avisos";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { createClient } from "@/lib/supabase/server";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { articulosDeCampana } from "@/lib/campanas/articulos";
import { fechaCorta } from "@/lib/formato";
import { ETIQUETA_ESTADO, ETIQUETA_SOPORTE } from "@/lib/etiquetas";
import { ProveedorAnadirPunto, ZonaMapaCampana } from "./anadir-punto";
import { AvisoFinalizar, BotonAnadirPunto, ControlesPunto, EditarCampana, EnlaceCliente } from "./controles";

export const dynamic = "force-dynamic";

function nombreCompleto(u: { nombre: string; apellidos: string | null }) {
  return `${u.nombre} ${u.apellidos ?? ""}`.trim();
}

function fechaHora(fecha: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(fecha));
}

function nombreVisiblePunto(nombre: string) {
  const limpio = nombre.trim();
  return /^\d+$/.test(limpio) ? `Punto ${limpio}` : limpio;
}

export default async function PaginaCampana({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campanaId = Number(id);
  if (!Number.isInteger(campanaId)) notFound();

  const supabase = await createClient();

  const resultadosBase = await Promise.all([
    supabase
      .from("campanas")
      .select("id, codigo, nombre, estado, fecha_inicio, fecha_fin, descripcion, documento_id, clientes(razon_social)")
      .eq("id", campanaId)
      .maybeSingle(),
    supabase
      .from("puntos_campana")
      .select(
        "id, nombre, tipo_soporte, linea_id, direccion, latitud, longitud, piezas, fecha_colocacion_prevista, fecha_retirada_prevista, estado, notas, incidencia",
      )
      .eq("campana_id", campanaId)
      .order("id"),
    supabase.from("usuarios").select("id, nombre, apellidos, rol").eq("activo", true).order("nombre"),
    supabase
      .from("enlaces_cliente")
      .select("token, vistas, expira_en")
      .eq("campana_id", campanaId)
      .eq("activo", true)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("documentos").select("id", { count: "exact", head: true }).eq("campana_id", campanaId),
  ]);
  lanzarSiError(...resultadosBase);
  const [{ data: campana }, { data: puntos }, { data: usuarios }, { data: enlace }, { count: documentosVinculados }] =
    resultadosBase;

  if (!campana) notFound();

  const idsPuntos = (puntos ?? []).map((p) => p.id);
  const [resAsignaciones, resFotos] = idsPuntos.length
    ? await Promise.all([
        supabase
          .from("asignaciones_punto")
          .select("id, punto_id, usuario_id, estado, rol_asignacion")
          .in("punto_id", idsPuntos)
          .neq("estado", "cancelada"),
        supabase
          .from("fotos_punto")
          .select("id, punto_id, usuario_id, tipo, url_foto, latitud, longitud, tomada_en, origen_foto, origen_ubicacion")
          .in("punto_id", idsPuntos)
          .order("tomada_en", { ascending: false }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  lanzarSiError(resAsignaciones, resFotos);
  const asignaciones = resAsignaciones.data;
  const fotos = resFotos.data;

  // URLs firmadas para las fotos (el bucket es privado; el admin puede leerlas todas).
  const rutas = (fotos ?? []).map((f) => f.url_foto);
  const { data: firmadas } = rutas.length
    ? await supabase.storage.from("fotos-puntos").createSignedUrls(rutas, 60 * 60)
    : { data: [] };
  const urlPorRuta = new Map(
    (firmadas ?? []).flatMap((f) => (f.path && f.signedUrl ? [[f.path, f.signedUrl] as const] : [])),
  );

  const usuarioPorId = new Map((usuarios ?? []).map((u) => [u.id, u]));
  const candidatos = (usuarios ?? []).map((u) => ({
    id: u.id,
    nombre: nombreCompleto(u) + (u.rol === "admin" ? " (admin)" : ""),
  }));

  const fechasCampana = { inicio: campana.fecha_inicio, fin: campana.fecha_fin };

  // Artículos de los presupuestos/facturas vinculados y piezas ya repartidas entre los puntos.
  const articulosCampana = await articulosDeCampana(supabase, campanaId);
  const repartidas = new Map<number, number>();
  for (const p of puntos ?? []) {
    if (p.linea_id != null) repartidas.set(p.linea_id, (repartidas.get(p.linea_id) ?? 0) + Number(p.piezas ?? 0));
  }
  const articulosPunto = articulosCampana.map((a) => ({
    id: a.id,
    etiqueta: a.artista ? `${a.nombre} — ${a.artista}` : a.nombre,
    documento: a.documento,
    piezas: a.piezas,
    repartidas: repartidas.get(a.id) ?? 0,
  }));
  const puntosParaMapa = (puntos ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    latitud: Number(p.latitud),
    longitud: Number(p.longitud),
  }));

  const cliente = Array.isArray(campana.clientes) ? campana.clientes[0] : campana.clientes;
  const lista = puntos ?? [];
  const contar = (estado: string) => lista.filter((p) => p.estado === estado).length;
  const hechos = contar("instalado") + contar("verificado") + contar("retirado");
  const pendientes = contar("pendiente");
  const incidencias = contar("incidencia");
  const retirados = contar("retirado");
  const verificados = contar("verificado");
  const totalFotos = (fotos ?? []).length;
  const porcentaje = lista.length > 0 ? Math.round((hechos / lista.length) * 100) : 0;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const urlEnlace = enlace ? `${protocolo}://${host}/c/${enlace.token}` : null;

  return (
    <div className="flex flex-col gap-esp5">
      <div className="flex flex-col gap-esp3">
        <Link
          href="/admin/campanas"
          className="group flex w-fit items-center gap-esp1 text-sm text-texto-secundario transition-colors duration-rapida ease-suave hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} className="transition-transform duration-rapida ease-salida group-hover:-translate-x-0.5" />
          Campañas
        </Link>

        {/* Blocco 1: Header unificata con barra metriche compatta e condivisione cliente */}
        <section className="overflow-hidden rounded-xl border border-borde-default bg-fondo-superficie">
          <div className="flex flex-wrap items-start justify-between gap-esp3 p-esp4 md:p-esp5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-esp2">
                <h1 className="text-2xl font-bold text-texto-primario md:text-titulo-pagina">
                  {campana.nombre}
                </h1>
                <Insignia tono={TONO_POR_ESTADO[campana.estado] ?? "neutro"}>
                  {ETIQUETA_ESTADO[campana.estado] ?? campana.estado}
                </Insignia>
                {campana.codigo && (
                  <span className="rounded bg-fondo-sutil px-2 py-0.5 font-mono text-xs text-texto-secundario">
                    {campana.codigo}
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-esp3 gap-y-1 text-xs text-texto-secundario">
                <span className="font-medium text-texto-primario">{cliente?.razon_social ?? "Sin cliente"}</span>
                {campana.fecha_inicio && campana.fecha_fin && (
                  <span className="tabular-nums text-texto-terciario">
                    {fechaCorta(campana.fecha_inicio)} – {fechaCorta(campana.fecha_fin)}
                  </span>
                )}
              </div>

              {campana.descripcion && (
                <p className="mt-esp2 max-w-3xl text-xs text-texto-secundario">{campana.descripcion}</p>
              )}
            </div>

            <BotonAvisos />
            <EditarCampana
              campanaId={campanaId}
              eliminable={!campana.documento_id && (documentosVinculados ?? 0) === 0}
              contenido={{ puntos: lista.length, fotos: totalFotos }}
              inicial={{
                nombre: campana.nombre,
                estado: campana.estado,
                fechaInicio: campana.fecha_inicio,
                fechaFin: campana.fecha_fin,
                descripcion: campana.descripcion,
              }}
            />
          </div>

          <div className="grid grid-cols-2 divide-y divide-borde-default border-t border-borde-default bg-fondo-sutil/50 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <div className="px-esp4 py-esp3">
              <p className="text-etiqueta uppercase text-texto-secundario">Instalación</p>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-esp2">
                <span className="tabular-nums text-base font-semibold text-texto-primario">
                  {hechos}/{lista.length}
                </span>
                <span className="tabular-nums text-xs font-medium text-texto-secundario">{porcentaje}%</span>
                {verificados > 0 && <span className="tabular-nums text-xs text-texto-exito">· {verificados} verif.</span>}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-completo bg-fondo-hover">
                <div
                  className="h-full rounded-completo bg-fondo-marca transition-[width] duration-lenta ease-salida"
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
            </div>

            <div className="px-esp4 py-esp3">
              <p className="text-etiqueta uppercase text-texto-secundario">Pendientes</p>
              <div className="mt-0.5 flex items-baseline gap-esp2">
                <span className="tabular-nums text-base font-semibold text-texto-primario">{pendientes}</span>
                <span className="text-xs text-texto-terciario">{pendientes === 0 ? "Al día" : "por instalar"}</span>
              </div>
            </div>

            <div className="px-esp4 py-esp3">
              <p className="text-etiqueta uppercase text-texto-secundario">Incidencias</p>
              <div className="mt-0.5 flex items-baseline gap-esp2">
                <span
                  className={`tabular-nums text-base font-semibold ${
                    incidencias > 0 ? "text-texto-peligro" : "text-texto-primario"
                  }`}
                >
                  {incidencias}
                </span>
                <span className={`text-xs ${incidencias > 0 ? "font-medium text-texto-peligro" : "text-texto-terciario"}`}>
                  {incidencias > 0 ? "activas" : "ninguna"}
                </span>
              </div>
            </div>

            <div className="px-esp4 py-esp3">
              <p className="text-etiqueta uppercase text-texto-secundario">Fotos y soportes</p>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-esp2">
                <span className="tabular-nums text-base font-semibold text-texto-primario">{totalFotos}</span>
                <span className="text-xs text-texto-secundario">{totalFotos === 1 ? "foto" : "fotos"}</span>
                {retirados > 0 && (
                  <span className="tabular-nums text-xs text-texto-terciario">
                    · {retirados}/{lista.length} ret.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-esp2 border-t border-borde-default bg-fondo-superficie px-esp4 py-esp3 sm:flex-row sm:items-center sm:gap-esp4 md:px-esp5">
            <span className="shrink-0 text-etiqueta uppercase text-texto-secundario">
              Enlace cliente
            </span>
            <div className="min-w-0 flex-1">
              <EnlaceCliente
                campanaId={campanaId}
                url={urlEnlace}
                vistas={Number(enlace?.vistas ?? 0)}
                expiraEn={enlace?.expira_en ?? null}
              />
            </div>
          </div>
        </section>
      </div>

      {lista.length > 0 && retirados === lista.length && campana.estado !== "finalizada" && (
        <AvisoFinalizar campanaId={campanaId} />
      )}

      <ProveedorAnadirPunto
        campanaId={campanaId}
        articulos={articulosPunto}
        fechasCampana={fechasCampana}
        otrosPuntos={puntosParaMapa}
      >
      {/* Blocco 2: Mappa panoramica & Riepilogo articoli (con el formulario de punto abierto: mapa para colocar + formulario) */}
      <ZonaMapaCampana
        titulo={`Mapa · ${campana.nombre}`}
        altura="clamp(240px, 34vh, 360px)"
        puntos={lista.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          latitud: Number(p.latitud),
          longitud: Number(p.longitud),
          estado: p.estado,
        }))}
        resumen={articulosPunto.length > 0 ? <ResumenArticulos articulos={articulosPunto} /> : null}
      />

      {/* Blocco 3: Sezione Puntos strutturata ad alta densità */}
      <section className="flex flex-col gap-esp3">
        <div className="flex flex-wrap items-center justify-between gap-esp3">
          <div className="flex items-center gap-esp2">
            <h2 className="text-titulo-panel text-texto-primario">Puntos</h2>
            <span className="tabular-nums rounded-completo border border-borde-default bg-fondo-superficie px-2 py-0.5 text-xs font-medium text-texto-secundario">
              {lista.length}
            </span>
          </div>
          <BotonAnadirPunto />
        </div>

        {lista.length > 0 ? (
          <div className="divide-y divide-borde-default overflow-hidden rounded-xl border border-borde-default bg-fondo-superficie">
            {lista.map((p, idx) => {
              const asignados = (asignaciones ?? [])
                .filter((a) => a.punto_id === p.id)
                .map((a) => {
                  const u = usuarioPorId.get(a.usuario_id);
                  return {
                    id: a.id,
                    usuarioId: a.usuario_id,
                    nombre: u ? nombreCompleto(u) : "Usuario",
                    estado: a.estado,
                    rol: a.rol_asignacion,
                  };
                });
              const fotosPunto = (fotos ?? []).filter((f) => f.punto_id === p.id);
              const esIncidencia = p.estado === "incidencia";

              return (
                <div
                  key={p.id}
                  className={`flex flex-col gap-esp3 px-esp4 py-esp4 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil/40 md:px-esp5 ${
                    esIncidencia ? "border-l-4 border-l-borde-peligro bg-fondo-peligro-sutil/20" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-esp3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-esp2">
                        <span className="tabular-nums flex h-6 w-6 shrink-0 items-center justify-center rounded bg-fondo-sutil font-mono text-xs font-semibold text-texto-secundario">
                          #{idx + 1}
                        </span>
                        <h3 className="text-sm font-semibold text-texto-primario">{nombreVisiblePunto(p.nombre)}</h3>
                        <span className="rounded border border-borde-default bg-fondo-sutil px-1.5 py-0.5 text-xs font-medium text-texto-secundario">
                          {ETIQUETA_SOPORTE[p.tipo_soporte] ?? p.tipo_soporte}
                        </span>
                        {p.piezas != null && (
                          <span className="tabular-nums text-xs text-texto-terciario">{num(Number(p.piezas))} pzs</span>
                        )}
                        <Insignia tono={TONO_POR_ESTADO[p.estado] ?? "neutro"}>
                          {ETIQUETA_ESTADO[p.estado] ?? p.estado}
                        </Insignia>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-esp3 gap-y-1 text-xs text-texto-secundario">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${p.latitud},${p.longitud}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-texto-secundario transition-colors duration-rapida ease-suave hover:text-texto-marca"
                        >
                          <Icono nombre="ubicacion" size={13} className="text-icono-marca" />
                          <span>{p.direccion || "Ver en Google Maps"}</span>
                        </a>
                        {(p.fecha_colocacion_prevista || p.fecha_retirada_prevista) && (
                          <span className="tabular-nums text-texto-terciario">
                            {p.fecha_colocacion_prevista ? `Colocar ${fechaCorta(p.fecha_colocacion_prevista)}` : ""}
                            {p.fecha_colocacion_prevista && p.fecha_retirada_prevista ? " · " : ""}
                            {p.fecha_retirada_prevista ? `Retirar ${fechaCorta(p.fecha_retirada_prevista)}` : ""}
                          </span>
                        )}
                      </div>

                      {p.notas && <p className="mt-1 text-xs text-texto-terciario">{p.notas}</p>}
                    </div>

                    <ControlesPunto
                      campanaId={campanaId}
                      puntoId={p.id}
                      estado={p.estado}
                      asignados={asignados}
                      candidatos={candidatos}
                      punto={{
                        id: p.id,
                        linea_id: p.linea_id,
                        nombre: p.nombre,
                        tipo_soporte: p.tipo_soporte,
                        direccion: p.direccion,
                        latitud: Number(p.latitud),
                        longitud: Number(p.longitud),
                        piezas: p.piezas == null ? null : Number(p.piezas),
                        fecha_colocacion_prevista: p.fecha_colocacion_prevista,
                        fecha_retirada_prevista: p.fecha_retirada_prevista,
                        notas: p.notas,
                      }}
                      tieneFotos={fotosPunto.length > 0}
                    />
                  </div>

                  {esIncidencia && p.incidencia && (
                    <p className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp3 py-esp2 text-xs text-texto-primario">
                      <strong className="text-texto-peligro">Incidencia:</strong> {p.incidencia}
                    </p>
                  )}

                  {fotosPunto.length > 0 && (
                    <div className="flex flex-wrap items-center gap-esp2 border-t border-borde-default pt-esp3">
                      {fotosPunto.map((f) => {
                        const url = urlPorRuta.get(f.url_foto);
                        const autor = f.usuario_id ? usuarioPorId.get(f.usuario_id) : undefined;
                        return (
                          <div
                            key={f.id}
                            className="flex items-center gap-esp2 rounded-md border border-borde-default bg-fondo-sutil/60 p-1 pr-esp3"
                          >
                            {url ? (
                              <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt={`Foto de ${nombreVisiblePunto(p.nombre)}`}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              </a>
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-fondo-hover text-micro text-texto-terciario">
                                —
                              </div>
                            )}
                            <div className="flex min-w-0 flex-col">
                              <p className="truncate text-xs font-medium text-texto-primario">
                                {autor ? nombreCompleto(autor) : "—"}
                              </p>
                              <p className="tabular-nums text-micro text-texto-terciario">
                                {fechaHora(f.tomada_en)}
                                {f.origen_foto === "galeria" ? " · galería" : ""}
                              </p>
                              {f.latitud != null && f.longitud != null ? (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${f.latitud},${f.longitud}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-micro font-medium text-texto-exito hover:underline"
                                >
                                  <Icono nombre="ubicacion" size={10} />
                                  {f.origen_ubicacion === "gps_al_subir"
                                    ? "Al subir"
                                    : f.origen_ubicacion === "exif"
                                      ? "EXIF"
                                      : "GPS"}
                                </a>
                              ) : (
                                <span className="text-micro text-texto-aviso">Sin GPS</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-borde-default bg-fondo-superficie px-esp4 py-esp6 text-center text-sm text-texto-terciario">
            Esta campaña aún no tiene puntos. Añade el primero desde el botón superior.
          </p>
        )}
      </section>
      </ProveedorAnadirPunto>
    </div>
  );
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

/** Cuántas piezas de cada artículo del documento están ya repartidas entre los puntos. */
function ResumenArticulos({
  articulos,
}: {
  articulos: { id: number; etiqueta: string; documento: string; piezas: number; repartidas: number }[];
}) {
  if (articulos.length === 0) return null;
  return (
    <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie p-esp4">
      <p className="text-etiqueta uppercase text-texto-secundario">Artículos repartidos</p>
      <div className="flex flex-col gap-esp3">
        {articulos.map((a) => {
          const restan = a.piezas - a.repartidas;
          const exceso = restan < 0;
          const porcentaje = a.piezas > 0 ? Math.min(100, Math.round((a.repartidas / a.piezas) * 100)) : 0;
          return (
            <div key={a.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-esp2 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium text-texto-primario" title={`${a.etiqueta} · ${a.documento}`}>
                  {a.etiqueta}
                </span>
                <span className={exceso ? "tabular-nums whitespace-nowrap text-texto-aviso" : "tabular-nums whitespace-nowrap text-texto-secundario"}>
                  {num(a.repartidas)} / {num(a.piezas)}
                  {exceso ? ` (+${num(-restan)})` : restan > 0 ? ` · ${num(restan)} rest.` : " · completo"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-completo bg-fondo-sutil">
                <div
                  className={
                    exceso
                      ? "h-full bg-fondo-aviso transition-[width] duration-lenta ease-salida"
                      : "h-full bg-fondo-marca transition-[width] duration-lenta ease-salida"
                  }
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
