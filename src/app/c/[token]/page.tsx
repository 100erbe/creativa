import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { MapaPuntos } from "@/components/mapa/mapa-puntos";

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
  const fotosPorPunto = new Map<number, typeof fotos>();
  for (const f of fotos ?? []) {
    const lista = fotosPorPunto.get(f.punto_id) ?? [];
    lista.push(f);
    fotosPorPunto.set(f.punto_id, lista);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-esp6 bg-fondo-lienzo px-esp4 py-esp8">
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
              // PENDIENTE: f.url_foto es la ruta dentro del bucket privado
              // "fotos-puntos" (p. ej. "punto_12/foto.jpg"), no una URL.
              // Como esta página es pública (rol anon, sin sesión), no puede
              // pedir una URL firmada igual que /app/punto/[id]. Dos opciones:
              //  1) mover las fotos ya aprobadas a un bucket público aparte, o
              //  2) generar aquí la URL firmada dentro de un Route Handler que
              //     use la service_role key (nunca en el cliente).
              // Hasta entonces esta cuadrícula no mostrará las imágenes.
              <div className="grid grid-cols-3 gap-esp2">
                {(fotosPorPunto.get(p.punto_id) ?? []).map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={f.url_foto}
                    src={f.url_foto}
                    alt={f.tipo}
                    className="aspect-square w-full rounded-md bg-fondo-sutil object-cover"
                  />
                ))}
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
