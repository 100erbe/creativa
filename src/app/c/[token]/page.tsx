import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { MapaPuntos } from "@/components/mapa/mapa-puntos";
import { Logo } from "@/components/ui/logo";

export const dynamic = "force-dynamic";

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
    supabase.rpc("obtener_campana_publica", { p_token: token }),
    supabase.rpc("obtener_fotos_publicas", { p_token: token }),
  ]);

  if (!filas || filas.length === 0) notFound();

  // Se registra la vista en segundo plano (no bloquea el render).
  supabase.rpc("registrar_vista_enlace", { p_token: token }).then(() => {});

  const cabecera = filas[0];
  if (!cabecera) notFound();
  // La función SQL no garantiza orden: se muestran siempre en el mismo orden de alta.
  filas.sort((a, b) => (a.punto_id ?? 0) - (b.punto_id ?? 0));
  const fotosPorPunto = new Map<number, typeof fotos>();
  for (const f of fotos ?? []) {
    const lista = fotosPorPunto.get(f.punto_id) ?? [];
    lista.push(f);
    fotosPorPunto.set(f.punto_id, lista);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-esp6 bg-fondo-lienzo px-esp4 py-esp8">
      <Logo alto={44} className="self-start" />

      <div>
        <p className="text-sm text-texto-secundario">{cabecera.cliente_nombre}</p>
        <h1 className="text-2xl font-semibold text-texto-primario">
          {cabecera.campana_nombre}
        </h1>
        <p className="text-sm text-texto-terciario">
          {cabecera.fecha_inicio} — {cabecera.fecha_fin}
        </p>
      </div>

      <MapaPuntos
        puntos={filas
          .filter((p) => p.punto_id !== null)
          .map((p) => ({
            id: p.punto_id!,
            nombre: p.punto_nombre ?? "Punto",
            latitud: p.latitud!,
            longitud: p.longitud!,
            estado: p.punto_estado ?? undefined,
          }))}
        altura={240}
      />

      <div className="flex flex-col gap-esp4">
        {filas.map((p) => (
          <div
            key={p.punto_id}
            className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie p-esp5"
          >
            <div className="flex items-center gap-esp3">
              <div className="flex-1">
                <p className="font-medium text-texto-primario">{p.punto_nombre}</p>
                <p className="text-sm text-texto-terciario">
                  {ETIQUETA_SOPORTE[p.tipo_soporte] ?? p.tipo_soporte}
                  {p.direccion ? ` · ${p.direccion}` : ""}
                </p>
              </div>
              <Insignia tono={TONO_POR_ESTADO[p.punto_estado] ?? "neutro"}>
                {p.punto_estado}
              </Insignia>
            </div>
            {(fotosPorPunto.get(p.punto_id) ?? []).length > 0 && (
              // f.url_foto es la ruta dentro del bucket privado "fotos-puntos".
              // Se sirve a través de /c/[token]/foto, que comprueba el token y
              // firma la URL en el servidor (ver foto/route.ts).
              <div className="grid grid-cols-2 gap-esp3 sm:grid-cols-3">
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
                      <p className="text-xs text-texto-terciario">
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
                          className="text-xs font-medium text-texto-exito"
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
