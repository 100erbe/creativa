import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { createClient } from "@/lib/supabase/server";
import { TarjetaKpi } from "@/components/ui/tarjeta-kpi";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { MapaPuntos } from "@/components/mapa/mapa-puntos";
import { fechaCorta } from "@/lib/formato";
import { ETIQUETA_ESTADO, ETIQUETA_SOPORTE } from "@/lib/etiquetas";
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

export default async function PaginaCampana({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campanaId = Number(id);
  if (!Number.isInteger(campanaId)) notFound();

  const supabase = await createClient();

  const resultadosBase =
    await Promise.all([
      supabase
        .from("campanas")
        .select("id, codigo, nombre, estado, fecha_inicio, fecha_fin, descripcion, clientes(razon_social)")
        .eq("id", campanaId)
        .maybeSingle(),
      supabase
        .from("puntos_campana")
        .select("id, nombre, tipo_soporte, direccion, latitud, longitud, piezas, fecha_colocacion_prevista, fecha_retirada_prevista, estado, notas, incidencia")
        .eq("campana_id", campanaId)
        .order("id"),
      supabase
        .from("usuarios")
        .select("id, nombre, apellidos, rol")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("enlaces_cliente")
        .select("token, vistas, expira_en")
        .eq("campana_id", campanaId)
        .eq("activo", true)
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  lanzarSiError(...resultadosBase);
  const [{ data: campana }, { data: puntos }, { data: usuarios }, { data: enlace }] = resultadosBase;

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

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const urlEnlace = enlace ? `${protocolo}://${host}/c/${enlace.token}` : null;

  return (
    <div className="flex flex-col gap-esp6">
      <div className="flex flex-col gap-esp2">
        <Link
          href="/admin/campanas"
          className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          Campañas
        </Link>
        <div className="flex items-center gap-esp3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-texto-primario">{campana.nombre}</h1>
            <p className="text-sm text-texto-secundario">
              {cliente?.razon_social ?? "—"}
              {campana.codigo ? ` · ${campana.codigo}` : ""}
              {campana.fecha_inicio && campana.fecha_fin
                ? ` · ${fechaCorta(campana.fecha_inicio)} – ${fechaCorta(campana.fecha_fin)}`
                : ""}
            </p>
          </div>
          <Insignia tono={TONO_POR_ESTADO[campana.estado] ?? "neutro"}>
            {ETIQUETA_ESTADO[campana.estado] ?? campana.estado}
          </Insignia>
        </div>
        {campana.descripcion && (
          <p className="max-w-3xl text-sm text-texto-secundario">{campana.descripcion}</p>
        )}
        <EditarCampana
          campanaId={campanaId}
          inicial={{
            nombre: campana.nombre,
            estado: campana.estado,
            fechaInicio: campana.fecha_inicio,
            fechaFin: campana.fecha_fin,
            descripcion: campana.descripcion,
          }}
        />
      </div>

      <div className="flex flex-wrap gap-esp4 [&>*]:min-w-[140px]">
        <TarjetaKpi etiqueta="Puntos" valor={String(lista.length)} />
        <TarjetaKpi
          etiqueta="Instalados"
          valor={`${hechos}/${lista.length}`}
          detalle={`${contar("verificado")} verificados`}
          colorDetalle="text-texto-exito"
        />
        <TarjetaKpi etiqueta="Pendientes" valor={String(contar("pendiente"))} />
        {contar("retirado") > 0 && <TarjetaKpi etiqueta="Retirados" valor={`${contar("retirado")}/${lista.length}`} />}
        <TarjetaKpi
          etiqueta="Incidencias"
          valor={String(contar("incidencia"))}
          colorDetalle="text-texto-peligro"
        />
        <TarjetaKpi etiqueta="Fotos" valor={String((fotos ?? []).length)} />
      </div>

      {lista.length > 0 && contar("retirado") === lista.length && campana.estado !== "finalizada" && (
        <AvisoFinalizar campanaId={campanaId} />
      )}

      <div className="flex flex-col-reverse gap-esp6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-esp4">
          <MapaPuntos
            altura={340}
            puntos={lista.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              latitud: Number(p.latitud),
              longitud: Number(p.longitud),
              estado: p.estado,
            }))}
          />

          <h2 className="text-base font-semibold text-texto-primario">Puntos</h2>
          <BotonAnadirPunto campanaId={campanaId} fechasCampana={fechasCampana} otrosPuntos={puntosParaMapa} />
          {lista.map((p) => {
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

            return (
              <div
                key={p.id}
                className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp4"
              >
                <div className="flex items-start gap-esp3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-texto-primario">{p.nombre}</p>
                    <p className="text-xs text-texto-terciario">
                      {ETIQUETA_SOPORTE[p.tipo_soporte] ?? p.tipo_soporte}
                      {p.direccion ? ` · ${p.direccion}` : ""}
                    </p>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${p.latitud},${p.longitud}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-texto-marca"
                  >
                    Ver en el mapa
                  </a>
                  <Insignia tono={TONO_POR_ESTADO[p.estado] ?? "neutro"}>
                    {ETIQUETA_ESTADO[p.estado] ?? p.estado}
                  </Insignia>
                </div>

                {p.estado === "incidencia" && p.incidencia && (
                  <p className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp3 py-esp2 text-xs text-texto-primario">
                    <strong className="text-texto-peligro">Incidencia:</strong> {p.incidencia}
                  </p>
                )}
                {p.notas && <p className="text-xs text-texto-secundario">Instrucciones: {p.notas}</p>}

                <ControlesPunto
                  campanaId={campanaId}
                  puntoId={p.id}
                  estado={p.estado}
                  asignados={asignados}
                  candidatos={candidatos}
                  punto={{
                    id: p.id,
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
                  fechasCampana={fechasCampana}
                  otrosPuntos={puntosParaMapa}
                />

                {fotosPunto.length > 0 && (
                  <div className="flex flex-wrap gap-esp3 border-t border-fondo-hover pt-esp3">
                    {fotosPunto.map((f) => {
                      const url = urlPorRuta.get(f.url_foto);
                      const autor = f.usuario_id ? usuarioPorId.get(f.usuario_id) : undefined;
                      return (
                        <div key={f.id} className="flex w-[132px] flex-col gap-1">
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`Foto de ${p.nombre}`}
                                className="aspect-square w-full rounded-md object-cover"
                              />
                            </a>
                          ) : (
                            <div className="flex aspect-square w-full items-center justify-center rounded-md bg-fondo-sutil text-xs text-texto-terciario">
                              No disponible
                            </div>
                          )}
                          <p className="truncate text-xs text-texto-secundario">
                            {autor ? nombreCompleto(autor) : "—"}
                          </p>
                          <p className="text-xs text-texto-terciario">
                            {fechaHora(f.tomada_en)}
                            {f.origen_foto === "galeria" ? " · 🖼 galería" : ""}
                          </p>
                          {f.latitud != null && f.longitud != null ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${f.latitud},${f.longitud}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-texto-exito"
                            >
                              <Icono nombre="ubicacion" size={12} />
                              {f.origen_ubicacion === "gps_al_subir"
                                ? "Ubicación al subir"
                                : f.origen_ubicacion === "exif"
                                  ? "Ubicación de la foto"
                                  : "Geolocalizada"}
                            </a>
                          ) : (
                            <p className="text-xs text-texto-aviso">Sin ubicación</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {lista.length === 0 && (
            <p className="text-sm text-texto-terciario">Esta campaña aún no tiene puntos.</p>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-esp4 xl:w-[340px]">
          <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp4">
            <h2 className="text-base font-semibold text-texto-primario">Enlace para el cliente</h2>
            <EnlaceCliente
              campanaId={campanaId}
              url={urlEnlace}
              vistas={Number(enlace?.vistas ?? 0)}
              expiraEn={enlace?.expira_en ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
