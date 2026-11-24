import Link from "next/link";
import { Icono } from "@/components/ui/iconos";
import { clasesBoton } from "@/components/ui/boton";
import { euros, fechaMedia } from "@/lib/formato";
import { cn } from "@/lib/cn";
import { plazoTrimestre, trimestreDe, etiquetaTipoIva } from "@/lib/gastos";
import { contarRevisiones, resumirTrimestre, type FilaIva, type GastoFiscal } from "@/lib/fiscal-gastos";
import { BotonZipFacturas } from "./boton-zip-facturas";

const MESES = ["ene–mar", "abr–jun", "jul–sep", "oct–dic"];
const DIA = 86_400_000;

/** Hoy en España (YYYY-MM-DD) como fecha UTC a medianoche, para contar días hasta el plazo. */
function hoyUtc(hoy: string) {
  return new Date(`${hoy}T00:00:00Z`);
}

function estadoPlazo(ejercicio: number, trimestre: number, hoy: string) {
  const plazo = plazoTrimestre(ejercicio, trimestre);
  const finTrimestre = new Date(Date.UTC(ejercicio, trimestre * 3, 0));
  const dias = Math.round((plazo.getTime() - hoyUtc(hoy).getTime()) / DIA);
  const fecha = fechaMedia(plazo.toISOString().slice(0, 10));
  if (hoyUtc(hoy) <= finTrimestre) return { texto: `En curso · plazo hasta el ${fecha}`, tono: "neutro" as const, dias };
  if (dias < 0) return { texto: `Plazo cerrado el ${fecha}`, tono: "neutro" as const, dias };
  return {
    texto: dias === 0 ? `Último día para presentar: hoy (${fecha})` : `Quedan ${dias} días · hasta el ${fecha}`,
    tono: dias <= 10 ? ("aviso" as const) : ("info" as const),
    dias,
  };
}

function TablaIva({ titulo, filas, casillas }: { titulo: string; filas: FilaIva[]; casillas: string }) {
  if (filas.length === 0) return null;
  const total = filas.reduce((s, f) => ({ base: s.base + f.base, cuota: s.cuota + f.cuota, deducible: s.deducible + f.deducible }), {
    base: 0,
    cuota: 0,
    deducible: 0,
  });
  return (
    <div className="flex flex-col gap-esp1">
      <p className="text-xs font-medium text-texto-secundario">
        {titulo} <span className="text-texto-terciario">· casillas {casillas}</span>
      </p>
      <table className="tabular-nums w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-texto-terciario">
            <th className="py-1 font-normal">Tipo</th>
            <th className="py-1 text-right font-normal">Base</th>
            <th className="py-1 text-right font-normal">Cuota</th>
            <th className="py-1 text-right font-normal">Deducible</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borde-default">
          {filas.map((f) => (
            <tr key={f.iva_pct}>
              <td className="py-1 text-texto-secundario">
                {etiquetaTipoIva(f.iva_pct)} <span className="text-xs text-texto-terciario">({f.n})</span>
              </td>
              <td className="py-1 text-right text-texto-primario">{euros(f.base)}</td>
              <td className="py-1 text-right text-texto-primario">{euros(f.cuota)}</td>
              <td className="py-1 text-right font-medium text-texto-primario">{euros(f.deducible)}</td>
            </tr>
          ))}
          {filas.length > 1 && (
            <tr className="font-semibold text-texto-primario">
              <td className="py-1">Total</td>
              <td className="py-1 text-right">{euros(total.base)}</td>
              <td className="py-1 text-right">{euros(total.cuota)}</td>
              <td className="py-1 text-right">{euros(total.deducible)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Cifra({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="tabular-nums flex flex-col">
      <span className="text-xs text-texto-secundario">{etiqueta}</span>
      <span className="text-base font-semibold text-texto-primario">{valor}</span>
      {nota && <span className="text-xs text-texto-terciario">{nota}</span>}
    </div>
  );
}

/** Lectura fiscal de un trimestre: IVA soportado (303), retenciones (111), gasto deducible (130), avisos y exportación. */
export function ResumenFiscalTrimestre({
  gastos,
  ejercicio,
  trimestre,
  hoy,
  enlaceRevision,
  actividadConfigurada,
}: {
  gastos: GastoFiscal[];
  ejercicio: number;
  trimestre: number;
  hoy: string;
  enlaceRevision: (clave: string) => string;
  actividadConfigurada: boolean;
}) {
  const r = resumirTrimestre(gastos, ejercicio, trimestre);
  const plazo = estadoPlazo(ejercicio, trimestre, hoy);
  const delTrimestre = gastos.filter((g) => g.fecha.startsWith(String(ejercicio)) && trimestreDe(g.fecha) === trimestre);
  const revisiones = contarRevisiones(delTrimestre).filter((x) => x.n > 0);
  const listo = revisiones.length === 0 && actividadConfigurada;

  return (
    <section className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 md:p-esp5">
      <div className="flex flex-wrap items-baseline gap-x-esp3 gap-y-1">
        <h2 className="text-titulo-panel text-texto-primario">
          Resumen fiscal T{trimestre} {ejercicio}
        </h2>
        <span className="text-xs text-texto-terciario">{MESES[trimestre - 1]}</span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-md px-esp2 py-1 text-xs font-medium",
            plazo.tono === "aviso" && "bg-fondo-aviso-sutil text-texto-aviso",
            plazo.tono === "info" && "bg-fondo-marca-sutil text-texto-marca",
            plazo.tono === "neutro" && "bg-fondo-sutil text-texto-secundario",
          )}
        >
          <Icono nombre="calendario" size={14} />
          303 · 130 · 111 — {plazo.texto}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-esp5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-esp4">
          {r.corrientes.length === 0 && r.inversion.length === 0 ? (
            <p className="text-sm text-texto-terciario">No hay gastos deducibles aprobados en este trimestre.</p>
          ) : (
            <>
              <TablaIva titulo="IVA soportado · operaciones corrientes" filas={r.corrientes} casillas="28–29" />
              <TablaIva titulo="IVA soportado · bienes de inversión" filas={r.inversion} casillas="30–31" />
            </>
          )}
          <div className="grid grid-cols-2 gap-esp4 rounded-lg bg-fondo-sutil px-esp4 py-esp3 md:grid-cols-4">
            <Cifra etiqueta="Casilla 28" valor={euros(r.casillas.c28)} nota="base corrientes" />
            <Cifra etiqueta="Casilla 29" valor={euros(r.casillas.c29)} nota="cuota deducible" />
            <Cifra etiqueta="Casilla 30" valor={euros(r.casillas.c30)} nota="base inversión" />
            <Cifra etiqueta="Casilla 31" valor={euros(r.casillas.c31)} nota="cuota deducible" />
          </div>
          <div className="grid grid-cols-1 gap-esp4 sm:grid-cols-3">
            <Cifra
              etiqueta="Retenciones practicadas (111)"
              valor={euros(r.retenciones.importe)}
              nota={
                r.retenciones.importe > 0
                  ? `${r.retenciones.perceptores} perceptor${r.retenciones.perceptores === 1 ? "" : "es"} · base ${euros(r.retenciones.base)}`
                  : "Sin retenciones a profesionales"
              }
            />
            <Cifra
              etiqueta="Gasto deducible IRPF (130)"
              valor={euros(r.gastoIrpf.acumulado)}
              nota={`Acumulado ene–T${trimestre} · ${euros(r.gastoIrpf.trimestre)} este trimestre`}
            />
            <Cifra etiqueta="Gastos menores" valor={euros(r.gastosMenores)} nota="No deducibles · solo referencia" />
          </div>
        </div>

        <div className="flex flex-col gap-esp3">
          <p className="text-xs font-medium text-texto-secundario">¿Listo para presentar?</p>
          {listo ? (
            <p className="flex items-center gap-esp2 rounded-md bg-fondo-exito-sutil px-esp3 py-esp2 text-sm text-texto-exito">
              <Icono nombre="check" size={16} /> Todo en orden en este trimestre.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde-default rounded-md border border-borde-default">
              {revisiones.map((x) => (
                <li key={x.clave}>
                  <Link
                    href={enlaceRevision(x.clave)}
                    className="flex items-center gap-esp2 px-esp3 py-esp2 text-sm hover:bg-fondo-sutil"
                  >
                    <Icono nombre="alerta" size={16} className="text-texto-aviso" />
                    <span className="flex-1 text-texto-primario">{x.etiqueta}</span>
                    <span className="tabular-nums font-semibold text-texto-aviso">{x.n}</span>
                  </Link>
                </li>
              ))}
              {!actividadConfigurada && (
                <li>
                  <Link href="/admin/ajustes/empresa" className="flex items-center gap-esp2 px-esp3 py-esp2 text-sm hover:bg-fondo-sutil">
                    <Icono nombre="alerta" size={16} className="text-texto-aviso" />
                    <span className="flex-1 text-texto-primario">Falta la actividad (epígrafe IAE) en Datos de la empresa</span>
                    <Icono nombre="chevron" size={14} className="text-icono-default" />
                  </Link>
                </li>
              )}
            </ul>
          )}
          <div className="mt-auto flex flex-wrap gap-esp2 pt-esp2">
            <a href={`/admin/gastos/libro-aeat?ejercicio=${ejercicio}&trimestre=${trimestre}`} download className={clasesBoton("secundario")}>
              <Icono nombre="descargar" size={16} />
              Libro registro AEAT (.xlsx)
            </a>
            <BotonZipFacturas ejercicio={ejercicio} trimestre={trimestre} />
          </div>
          <p className="text-xs text-texto-terciario">
            El libro va de enero al final del T{trimestre} (como pide la AEAT) e incluye facturas emitidas y gastos. Se
            importa en Pre303 y en el modelo 130. Cifras orientativas: revísalas con tu gestor.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Sin trimestre elegido: una tarjeta por trimestre con lo esencial, para entrar en cada uno. */
export function ResumenFiscalAnual({
  gastos,
  ejercicio,
  hoy,
  enlaceTrimestre,
}: {
  gastos: GastoFiscal[];
  ejercicio: number;
  hoy: string;
  enlaceTrimestre: (t: number) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-esp3 md:gap-esp4 xl:grid-cols-4">
      {[1, 2, 3, 4].map((t) => {
        const r = resumirTrimestre(gastos, ejercicio, t);
        const plazo = estadoPlazo(ejercicio, t, hoy);
        const avisos = contarRevisiones(gastos.filter((g) => g.fecha.startsWith(String(ejercicio)) && trimestreDe(g.fecha) === t)).reduce(
          (s, x) => s + x.n,
          0,
        );
        return (
          <Link
            key={t}
            href={enlaceTrimestre(t)}
            className="tabular-nums flex flex-col gap-1 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 text-sm transition-colors duration-rapida ease-suave hover:border-borde-fuerte hover:bg-fondo-sutil"
          >
            <span className="flex items-baseline gap-esp2">
              <strong className="text-texto-primario">T{t}</strong>
              <span className="text-xs text-texto-terciario">{MESES[t - 1]}</span>
            </span>
            <span className="flex text-texto-secundario">
              <span className="flex-1">IVA deducible</span>
              <span className="text-texto-primario">{euros(r.casillas.c29 + r.casillas.c31)}</span>
            </span>
            <span className="flex text-texto-secundario">
              <span className="flex-1">Retenciones</span>
              <span className="text-texto-primario">{euros(r.retenciones.importe)}</span>
            </span>
            <span className={cn("text-xs", avisos ? "text-texto-aviso" : "text-texto-terciario")}>
              {avisos ? `⚠ ${avisos} aviso${avisos === 1 ? "" : "s"} por revisar` : "Sin avisos"}
            </span>
            <span className={cn("text-xs", plazo.tono === "aviso" ? "text-texto-aviso" : "text-texto-terciario")}>{plazo.texto}</span>
          </Link>
        );
      })}
    </div>
  );
}
