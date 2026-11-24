import Link from "next/link";
import { euros } from "@/lib/formato";
import { leerLecturaTicket, pareceDeducible } from "@/lib/datos-ticket";
import type { TipoGasto } from "@/lib/gastos";

const DOCUMENTO = {
  factura_simplificada: "Factura simplificada",
  factura_completa: "Factura completa",
  otro: "No parece una factura",
} as const;

/**
 * Lo que la IA leyó del ticket, para la revisión del admin. Si un gasto menor parece una factura con
 * IVA deducible, propone convertirlo (abre el formulario ya rellenado con los datos fiscales).
 */
export function LecturaTicketResumen({
  gastoId,
  tipo,
  datos,
  editable,
}: {
  gastoId: number;
  tipo: TipoGasto;
  datos: unknown;
  editable: boolean;
}) {
  const l = leerLecturaTicket(datos);
  if (!l) return null;
  const sugerirDeducible = tipo === "menor" && pareceDeducible(l);
  const filas: [string, string | null][] = [
    ["Documento", DOCUMENTO[l.tipo_documento]],
    ["Proveedor", l.proveedor],
    ["NIF", l.nif_proveedor],
    ["Nº", l.numero_factura],
    ["Total", l.total != null ? euros(l.total) : null],
    ["IVA", l.iva_pct != null ? `${l.iva_pct} %${l.cuota_iva != null ? ` · cuota ${euros(l.cuota_iva)}` : ""}` : null],
  ];

  return (
    <div className="flex flex-col gap-esp2 rounded-md border border-borde-default bg-fondo-sutil px-esp4 py-esp3">
      <p className="text-xs font-medium text-texto-secundario">Leído del ticket (automático, orientativo)</p>
      <dl className="grid grid-cols-2 gap-x-esp4 gap-y-esp1 text-xs">
        {filas
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex gap-esp1">
              <dt className="text-texto-terciario">{k}:</dt>
              <dd className="min-w-0 truncate text-texto-primario">{v}</dd>
            </div>
          ))}
      </dl>
      {l.campos_dudosos.length > 0 && (
        <p className="text-xs text-texto-aviso">⚠ No se leía bien: {l.campos_dudosos.join(", ")}</p>
      )}
      {sugerirDeducible && (
        <div className="flex flex-wrap items-center gap-esp2 rounded bg-fondo-marca-sutil px-esp3 py-esp2 text-xs text-texto-primario">
          <span className="min-w-0 flex-1">
            <strong>Parece deducible:</strong> factura con NIF e IVA del {l.iva_pct} %.
          </span>
          {editable && (
            <Link href={`/admin/gastos/${gastoId}/editar?desde_ticket=1`} className="font-semibold text-texto-marca">
              Convertir en deducible →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
