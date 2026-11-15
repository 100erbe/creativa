import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Icono } from "@/components/ui/iconos";
import { ETIQUETA_TIPO } from "@/lib/documentos";
import { Cuentas, FormasPago } from "./controles";

export const dynamic = "force-dynamic";

export default async function PaginaPagos() {
  const supabase = await createClient();
  const resultados = await Promise.all([
    supabase.from("formas_pago").select("id, nombre, dias_vencimiento, texto_factura").order("nombre"),
    supabase.from("cuentas_bancarias").select("id, banco, iban, por_defecto, activa").order("banco"),
    supabase.from("series").select("id, codigo, tipo, nombre, prefijo, digitos, sufijo_anual, por_defecto, activa").order("tipo"),
  ]);
  lanzarSiError(...resultados);
  const [{ data: formas }, { data: cuentas }, { data: series }] = resultados;

  return (
    <div className="flex max-w-3xl flex-col gap-esp6">
      <div className="flex flex-col gap-esp2">
        <Link
          href="/admin/ajustes"
          className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          Ajustes
        </Link>
        <h1 className="text-2xl font-semibold text-texto-primario">Formas de pago y cuentas</h1>
      </div>

      <section className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp5">
        <div>
          <h2 className="text-base font-semibold text-texto-primario">Formas de pago</h2>
          <p className="text-xs text-texto-terciario">
            El texto se imprime en el documento y los días fijan el vencimiento al emitir.
          </p>
        </div>
        <FormasPago formas={formas ?? []} />
      </section>

      <section className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp5">
        <div>
          <h2 className="text-base font-semibold text-texto-primario">Cuentas bancarias</h2>
          <p className="text-xs text-texto-terciario">
            Las cuentas no se borran: se desactivan, para que los documentos antiguos conserven la suya.
          </p>
        </div>
        <Cuentas cuentas={cuentas ?? []} />
      </section>

      <section className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp5">
        <div>
          <h2 className="text-base font-semibold text-texto-primario">Series de numeración</h2>
          <p className="text-xs text-texto-terciario">
            Solo lectura: la numeración correlativa es una obligación legal y no se cambia desde la app.
          </p>
        </div>
        <div className="flex flex-col divide-y divide-fondo-hover">
          {(series ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-esp3 py-esp2 text-sm">
              <span className="w-12 font-medium text-texto-primario">{s.codigo}</span>
              <span className="flex-1 text-texto-secundario">
                {s.nombre} · {ETIQUETA_TIPO[s.tipo] ?? s.tipo}
              </span>
              <span className="text-xs text-texto-terciario">
                {s.prefijo}
                {"0".repeat(Math.max(0, s.digitos - 1))}1{s.sufijo_anual ? "/AA" : ""}
                {s.por_defecto ? " · por defecto" : ""}
                {s.activa ? "" : " · inactiva"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
