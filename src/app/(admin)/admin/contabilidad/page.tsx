import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { TarjetaKpi } from "@/components/ui/tarjeta-kpi";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaMedia } from "@/lib/formato";
import { ETIQUETA_COBRO, ETIQUETA_TIPO } from "@/lib/documentos";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

const TRIMESTRES = [
  { n: 1, meses: "ene–mar" },
  { n: 2, meses: "abr–jun" },
  { n: 3, meses: "jul–sep" },
  { n: 4, meses: "oct–dic" },
];

type Filtros = { ejercicio?: string; trimestre?: string; q?: string; pagina?: string };

function enlace(actual: Filtros, cambios: Partial<Filtros>) {
  const f = { ...actual, ...cambios };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `/admin/contabilidad?${s}` : "/admin/contabilidad";
}

export default async function PaginaContabilidad({
  searchParams,
}: {
  searchParams: Promise<Filtros>;
}) {
  const filtros = await searchParams;
  const supabase = await createClient();

  const resultados = await Promise.all([
    supabase
      .from("v_resumen_iva_trimestral")
      .select("*")
      .order("ejercicio")
      .order("trimestre")
      .order("iva_pct"),
    supabase.from("v_libro_registro").select("*").order("fecha_expedicion").order("numero").limit(5000),
  ]);
  lanzarSiError(...resultados);
  const [{ data: iva }, { data: libroAnio }] = resultados;

  const ejercicios = [
    ...new Set([...(iva ?? []).map((r) => r.ejercicio), ...(libroAnio ?? []).map((r) => r.ejercicio)]),
  ]
    .filter((e): e is number => e != null)
    .sort((a, b) => b - a);
  const pedido = Number(filtros.ejercicio);
  const ejercicio = ejercicios.includes(pedido) ? pedido : (ejercicios[0] ?? new Date().getFullYear());
  const trimestre = [1, 2, 3, 4].includes(Number(filtros.trimestre)) ? Number(filtros.trimestre) : 0;
  const q = (filtros.q ?? "").trim().toLowerCase();
  const pagina = Math.max(1, Number(filtros.pagina) || 1);

  const delAnio = (libroAnio ?? []).filter((f) => f.ejercicio === ejercicio);
  const filtradas = delAnio.filter(
    (f) =>
      (!trimestre || f.periodo === `T${trimestre}`) &&
      (!q ||
        [f.numero, f.destinatario, f.nif_destinatario, f.descripcion].some((v) => v?.toLowerCase().includes(q))),
  );
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visibles = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const suma = (filas: typeof delAnio, campo: "base_imponible" | "cuota_iva" | "total" | "pendiente") =>
    filas.reduce((s, f) => s + Number(f[campo] ?? 0), 0);

  const ivaAnio = (iva ?? []).filter((r) => r.ejercicio === ejercicio);
  const baseAnio = suma(delAnio, "base_imponible");
  const cuotaAnio = suma(delAnio, "cuota_iva");
  const pendienteAnio = suma(delAnio, "pendiente");

  // Facturas cuya fecha cae en un año distinto al ejercicio: el trimestre se calcula por fecha,
  // así que conviene revisarlas antes de presentar impuestos.
  const fechaAjena = delAnio.filter(
    (f) => f.fecha_expedicion && new Date(f.fecha_expedicion).getFullYear() !== ejercicio,
  );

  const actual: Filtros = {
    ejercicio: String(ejercicio),
    trimestre: trimestre ? String(trimestre) : "",
    q: filtros.q ?? "",
  };
  const exportar = `/admin/contabilidad/exportar?ejercicio=${ejercicio}${trimestre ? `&trimestre=${trimestre}` : ""}`;

  return (
    <div className="flex flex-col gap-esp6">
      <div className="flex flex-wrap items-center gap-esp3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-texto-primario">Contabilidad</h1>
          <p className="text-sm text-texto-secundario">Libro registro de facturas emitidas e IVA repercutido.</p>
        </div>
        <form action="/admin/contabilidad" className="flex items-center gap-esp2">
          <label className="text-sm text-texto-secundario" htmlFor="ejercicio">
            Ejercicio
          </label>
          <select
            id="ejercicio"
            name="ejercicio"
            defaultValue={ejercicio}
            className="h-9 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp2 text-sm text-texto-primario"
          >
            {(ejercicios.length ? ejercicios : [ejercicio]).map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <Boton type="submit" variante="secundario">
            Ver
          </Boton>
        </form>
      </div>

      <div className="flex flex-wrap gap-esp4 [&>*]:min-w-[160px]">
        <TarjetaKpi etiqueta={`Base imponible ${ejercicio}`} valor={euros(baseAnio)} detalle={`${delAnio.length} documentos`} />
        <TarjetaKpi etiqueta="IVA repercutido" valor={euros(cuotaAnio)} />
        <TarjetaKpi etiqueta="Total facturado" valor={euros(suma(delAnio, "total"))} />
        <TarjetaKpi
          etiqueta="Pendiente de cobro"
          valor={euros(pendienteAnio)}
          colorDetalle="text-texto-peligro"
          detalle={`${delAnio.filter((f) => f.estado_cobro === "vencida").length} vencidas`}
        />
      </div>

      {fechaAjena.length > 0 && (
        <div className="flex items-start gap-esp3 rounded-md border border-borde-aviso bg-fondo-aviso-sutil px-esp4 py-esp3">
          <Icono nombre="alerta" size={18} className="mt-0.5 text-texto-aviso" />
          <p className="text-sm text-texto-primario">
            <strong>Revisar:</strong> {fechaAjena.length} documento{fechaAjena.length === 1 ? "" : "s"} del ejercicio{" "}
            {ejercicio} {fechaAjena.length === 1 ? "tiene" : "tienen"} fecha de otro año (
            {fechaAjena.map((f) => `${f.numero} · ${fechaMedia(f.fecha_expedicion ?? "")}`).join("; ")}). Su trimestre
            se calcula por la fecha, no por el ejercicio.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-esp3">
        <h2 className="text-base font-semibold text-texto-primario">IVA repercutido por trimestre</h2>
        <div className="grid grid-cols-1 gap-esp4 md:grid-cols-2 xl:grid-cols-4">
          {TRIMESTRES.map((t) => {
            const filas = ivaAnio.filter((r) => r.trimestre === t.n);
            const nFacturas = delAnio.filter((f) => f.periodo === `T${t.n}`).length;
            const base = filas.reduce((s, r) => s + Number(r.base_imponible ?? 0), 0);
            const cuota = filas.reduce((s, r) => s + Number(r.cuota_iva ?? 0), 0);
            return (
              <div
                key={t.n}
                className="flex flex-col gap-esp2 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp4"
              >
                <div className="flex items-baseline gap-esp2">
                  <h3 className="text-sm font-semibold text-texto-primario">T{t.n}</h3>
                  <span className="text-xs text-texto-terciario">
                    {t.meses} · {nFacturas} documento{nFacturas === 1 ? "" : "s"}
                  </span>
                </div>
                {filas.length === 0 ? (
                  <p className="py-esp2 text-sm text-texto-terciario">Sin facturas.</p>
                ) : (
                  <>
                    {filas.map((r) => (
                      <div key={String(r.iva_pct)} className="flex flex-col text-sm">
                        <span className="text-xs text-texto-terciario">
                          {Number(r.iva_pct)} % {Number(r.iva_pct) === 0 ? "(exento / inv. sujeto pasivo)" : ""}
                        </span>
                        <span className="flex text-texto-secundario">
                          <span className="flex-1">Base</span>
                          <span className="text-texto-primario">{euros(Number(r.base_imponible))}</span>
                        </span>
                        <span className="flex text-texto-secundario">
                          <span className="flex-1">Cuota</span>
                          <span className="text-texto-primario">{euros(Number(r.cuota_iva))}</span>
                        </span>
                      </div>
                    ))}
                    <div className="h-px bg-fondo-hover" />
                    <div className="flex text-sm font-semibold text-texto-primario">
                      <span className="flex-1">IVA repercutido</span>
                      <span>{euros(cuota)}</span>
                    </div>
                    <div className="flex text-xs text-texto-terciario">
                      <span className="flex-1">Base total</span>
                      <span>{euros(base)}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-texto-terciario">
          Solo incluye el IVA de tus ventas. El IVA soportado de tus compras no se registra en la app, así que el
          resultado del modelo 303 se obtiene restándolo aparte.
        </p>
      </div>

      <div className="flex flex-col gap-esp3">
        <div className="flex flex-wrap items-center gap-esp3">
          <h2 className="flex-1 text-base font-semibold text-texto-primario">Libro registro</h2>
          <a href={exportar} download>
            <Boton variante="secundario">
              <Icono nombre="descargar" size={16} />
              Exportar CSV{trimestre ? ` (T${trimestre})` : ""}
            </Boton>
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-esp3">
          <div className="flex flex-wrap gap-esp2">
            {[{ n: 0, etiqueta: "Todo el año" }, ...TRIMESTRES.map((t) => ({ n: t.n, etiqueta: `T${t.n}` }))].map((t) => (
              <Link
                key={t.n}
                href={enlace(actual, { trimestre: t.n ? String(t.n) : "", pagina: "" })}
                className={
                  trimestre === t.n
                    ? "rounded-completo bg-fondo-marca px-esp3 py-esp1 text-sm font-medium text-texto-sobre-marca"
                    : "rounded-completo border border-borde-default bg-fondo-superficie px-esp3 py-esp1 text-sm text-texto-secundario hover:bg-fondo-sutil"
                }
              >
                {t.etiqueta}
              </Link>
            ))}
          </div>
          <form action="/admin/contabilidad" className="ml-auto flex items-center gap-esp2">
            <input type="hidden" name="ejercicio" value={ejercicio} />
            {trimestre ? <input type="hidden" name="trimestre" value={trimestre} /> : null}
            <input
              name="q"
              defaultValue={filtros.q ?? ""}
              placeholder="Número, cliente o NIF…"
              className="h-9 w-[220px] rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco"
            />
            <Boton type="submit" variante="secundario">
              Buscar
            </Boton>
          </form>
        </div>

        <div className="overflow-x-auto rounded-lg border border-borde-default bg-fondo-superficie">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-borde-default text-xs text-texto-terciario">
                <th className="px-esp4 py-esp3 font-medium">Fecha</th>
                <th className="px-esp3 py-esp3 font-medium">Número</th>
                <th className="px-esp3 py-esp3 font-medium">Destinatario</th>
                <th className="px-esp3 py-esp3 text-right font-medium">Base</th>
                <th className="px-esp3 py-esp3 text-right font-medium">IVA</th>
                <th className="px-esp3 py-esp3 text-right font-medium">Total</th>
                <th className="px-esp4 py-esp3 font-medium">Cobro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fondo-hover">
              {visibles.map((f) => (
                <tr key={`${f.serie}-${f.numero}`} className="hover:bg-fondo-sutil">
                  <td className="whitespace-nowrap px-esp4 py-esp2 text-texto-secundario">
                    {f.fecha_expedicion ? fechaMedia(f.fecha_expedicion) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-esp3 py-esp2">
                    <Link
                      href={`/admin/documentos?q=${encodeURIComponent(f.numero ?? "")}`}
                      className="font-medium text-texto-marca"
                    >
                      {f.numero}
                    </Link>
                    {f.tipo === "rectificativa" && (
                      <span className="ml-1 text-xs text-texto-terciario">{ETIQUETA_TIPO.rectificativa}</span>
                    )}
                  </td>
                  <td className="px-esp3 py-esp2">
                    <p className="text-texto-primario">{f.destinatario ?? "—"}</p>
                    <p className="text-xs text-texto-terciario">{f.nif_destinatario ?? "Sin NIF"}</p>
                  </td>
                  <td className="px-esp3 py-esp2 text-right text-texto-primario">{euros(Number(f.base_imponible))}</td>
                  <td className="px-esp3 py-esp2 text-right text-texto-primario">{euros(Number(f.cuota_iva))}</td>
                  <td className="px-esp3 py-esp2 text-right font-medium text-texto-primario">
                    {euros(Number(f.total))}
                  </td>
                  <td className="px-esp4 py-esp2">
                    {f.estado_cobro && (
                      <Insignia tono={TONO_POR_ESTADO[f.estado_cobro] ?? "neutro"}>
                        {ETIQUETA_COBRO[f.estado_cobro] ?? f.estado_cobro}
                      </Insignia>
                    )}
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-esp4 py-esp5 text-texto-terciario">
                    No hay facturas con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
            {filtradas.length > 0 && (
              <tfoot>
                <tr className="border-t border-borde-default bg-fondo-sutil font-semibold text-texto-primario">
                  <td className="px-esp4 py-esp3" colSpan={3}>
                    Total ({filtradas.length} documento{filtradas.length === 1 ? "" : "s"})
                  </td>
                  <td className="px-esp3 py-esp3 text-right">{euros(suma(filtradas, "base_imponible"))}</td>
                  <td className="px-esp3 py-esp3 text-right">{euros(suma(filtradas, "cuota_iva"))}</td>
                  <td className="px-esp3 py-esp3 text-right">{euros(suma(filtradas, "total"))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {paginas > 1 && (
          <div className="flex items-center justify-center gap-esp4 text-sm text-texto-secundario">
            {pagina > 1 ? (
              <Link href={enlace(actual, { pagina: String(pagina - 1) })} className="font-medium text-texto-marca">
                ← Anterior
              </Link>
            ) : (
              <span className="text-texto-terciario">← Anterior</span>
            )}
            <span>
              Página {pagina} de {paginas}
            </span>
            {pagina < paginas ? (
              <Link href={enlace(actual, { pagina: String(pagina + 1) })} className="font-medium text-texto-marca">
                Siguiente →
              </Link>
            ) : (
              <span className="text-texto-terciario">Siguiente →</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
