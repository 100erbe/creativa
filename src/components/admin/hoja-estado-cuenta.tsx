// Hoja A4 del estado de cuenta de un cliente: todas sus facturas, su situación de cobro
// y las insolutas resaltadas con su total. Componente de presentación puro.

import { documento } from "@/design/tokens";
import { fechaNumerica } from "@/lib/formato";
import { formatoEuros, formatoImporte } from "@/lib/documento-impresion";
import { DIAS_PARA_INSOLUTA, ETIQUETA_ESTADO_LINEA, type EstadoLinea } from "@/lib/estado-cuenta";
import type { DatosEstadoCuenta } from "@/lib/estado-cuenta-datos";

const AZUL = "text-documento-acento";

const COLOR_ESTADO: Record<EstadoLinea, string> = {
  pagada: "text-documento-sello",
  pendiente: "text-documento-texto-suave",
  parcial: "text-documento-texto-suave",
  insoluta: "text-documento-insoluto font-bold",
  abono_aplicado: "text-documento-tenue",
  abono_pendiente: "text-documento-acento",
};

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <p className={`mb-1 text-[7.5pt] font-semibold uppercase tracking-[0.09em] ${AZUL}`}>{children}</p>;
}

function Resumen({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`flex flex-col px-[4mm] py-[2.5mm] ${destacado ? "bg-documento-insoluto text-documento-sobre-acento" : "bg-documento-fondo"}`}>
      <span className={`text-[7pt] font-semibold uppercase tracking-[0.08em] ${destacado ? "" : "text-documento-tenue"}`}>{etiqueta}</span>
      <span className="text-[12pt] font-bold tabular-nums">{valor}</span>
    </div>
  );
}

export function HojaEstadoCuenta({ d }: { d: DatosEstadoCuenta }) {
  const { estado } = d;
  const hayAbonos = estado.abonosPendientes < 0;

  return (
    <>
      <style>{`
        @page { size: A4; margin: 14mm 18mm 18mm 18mm;
          @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.5pt Arial, Helvetica, sans-serif; color: ${documento.tenue}; } }
        .hoja-documento, .hoja-documento * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { html, body { background: ${documento.papel} !important; } }
      `}</style>

      <article
        className="hoja-documento mx-auto flex w-[210mm] max-w-none flex-col bg-documento-papel px-[18mm] pb-[16mm] pt-[14mm] text-[9.5pt] leading-[1.4] text-documento-texto shadow-sm ring-1 ring-documento-linea min-h-[297mm] print:min-h-[262mm] print:w-auto print:p-0 print:shadow-none print:ring-0"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-[5mm]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.empresa.logoPrincipal} alt={d.empresa.nombreComercial ?? "Logo"} className="h-[13mm] w-auto" />
            {d.empresa.logoSecundario && (
              <>
                <span className="h-[10mm] w-px bg-documento-borde" aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.empresa.logoSecundario} alt="Crea Comunicación" className="h-[12mm] w-auto" />
              </>
            )}
          </div>
          <div className="text-right">
            <p className={`text-[19pt] font-bold leading-none tracking-[0.04em] ${AZUL}`}>ESTADO DE CUENTA</p>
            <p className="mt-[1.5mm] text-[10pt] font-bold">A fecha {fechaNumerica(estado.fecha)}</p>
          </div>
        </header>

        <div className="mt-[4mm] h-[0.7mm] bg-documento-acento" />

        <section className="mt-[6mm] grid grid-cols-2">
          <div className="pr-[6mm]">
            <Etiqueta>Emisor</Etiqueta>
            <p className="text-[10pt] font-bold">{d.empresa.razonSocial ?? d.empresa.nombreComercial}</p>
            {d.empresa.nif && <p>NIF {d.empresa.nif}</p>}
            {d.empresa.direccion && <p className="whitespace-pre-line">{d.empresa.direccion}</p>}
          </div>
          <div className="border-l border-documento-borde pl-[6mm]">
            <Etiqueta>Cliente</Etiqueta>
            <p className="text-[10pt] font-bold">{d.cliente.razonSocial}</p>
            {d.cliente.documento && <p>{d.cliente.documento}</p>}
            {d.cliente.direccion && <p className="whitespace-pre-line">{d.cliente.direccion}</p>}
          </div>
        </section>

        <section className={`mt-[6mm] grid gap-[2mm] ${hayAbonos ? "grid-cols-4" : "grid-cols-3"}`}>
          <Resumen etiqueta="Total facturado" valor={formatoEuros(estado.totalFacturado)} />
          <Resumen etiqueta="Pendiente de cobro" valor={formatoEuros(estado.totalPendiente)} />
          {hayAbonos && <Resumen etiqueta="Abonos sin aplicar" valor={formatoEuros(estado.abonosPendientes)} />}
          <Resumen
            etiqueta={`Total insoluto (${estado.insolutas.length} ${estado.insolutas.length === 1 ? "factura" : "facturas"})`}
            valor={formatoEuros(estado.totalInsoluto)}
            destacado={estado.totalInsoluto > 0}
          />
        </section>

        <section className="mt-[6mm]">
          <Etiqueta>Detalle de facturas</Etiqueta>
          <table className="w-full border-collapse text-[8.5pt]">
            <thead>
              <tr className="bg-documento-acento text-left text-[7.5pt] uppercase tracking-[0.06em] text-documento-sobre-acento">
                <th className="px-[2mm] py-[1.8mm] font-semibold">Factura</th>
                <th className="px-[2mm] py-[1.8mm] font-semibold">Fecha</th>
                <th className="px-[2mm] py-[1.8mm] text-right font-semibold">Días desde emisión</th>
                <th className="px-[2mm] py-[1.8mm] font-semibold">Estado</th>
                <th className="px-[2mm] py-[1.8mm] text-right font-semibold">Total €</th>
                <th className="whitespace-nowrap px-[2mm] py-[1.8mm] text-right font-semibold">Pendiente €</th>
              </tr>
            </thead>
            <tbody>
              {estado.lineas.map((l) => {
                const insoluta = l.estado === "insoluta";
                return (
                  <tr
                    key={l.id}
                    className={`border-b border-documento-linea align-top [break-inside:avoid] ${insoluta ? "bg-documento-insoluto-fondo" : ""}`}
                    style={insoluta ? { boxShadow: `inset 1.2mm 0 0 ${documento.insoluto}` } : undefined}
                  >
                    <td className={`py-[1.6mm] pl-[3mm] pr-[2mm] ${insoluta ? "font-bold" : "font-medium"}`}>
                      {l.numero}
                      {l.concepto && <span className="block text-[7.5pt] font-normal text-documento-tenue">{l.concepto}</span>}
                    </td>
                    <td className="whitespace-nowrap px-[2mm] py-[1.6mm] tabular-nums">{fechaNumerica(l.fecha)}</td>
                    <td className="px-[2mm] py-[1.6mm] text-right tabular-nums">{l.diasDesdeEmision}</td>
                    <td className={`px-[2mm] py-[1.6mm] ${COLOR_ESTADO[l.estado]}`}>
                      {ETIQUETA_ESTADO_LINEA[l.estado]}
                      {insoluta && (
                        <span className="block text-[7pt] font-normal">
                          más de {DIAS_PARA_INSOLUTA} días
                        </span>
                      )}
                      {l.abonos.length > 0 && (
                        <span className="block text-[7pt] font-normal text-documento-tenue">descontado {l.abonos.join(", ")}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-[2mm] py-[1.6mm] text-right tabular-nums">{formatoImporte(l.total)}</td>
                    <td
                      className={`whitespace-nowrap px-[2mm] py-[1.6mm] text-right tabular-nums ${insoluta ? "font-bold text-documento-insoluto" : ""}`}
                    >
                      {Math.abs(l.saldo) > 0.005 ? formatoImporte(l.saldo) : "—"}
                    </td>
                  </tr>
                );
              })}
              {estado.lineas.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-[4mm] text-center text-documento-tenue">
                    No hay facturas emitidas a este cliente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="ml-auto mt-[5mm] w-[95mm] [break-inside:avoid]">
          <div className="flex gap-4 py-[1.2mm] text-[9.5pt]">
            <span className="flex-1 text-documento-tenue">Total facturas insolutas</span>
            <span className="whitespace-nowrap tabular-nums">{formatoEuros(estado.totalInsoluto)}</span>
          </div>
          {hayAbonos && (
            <div className="flex gap-4 py-[1.2mm] text-[9.5pt]">
              <span className="flex-1 text-documento-tenue">Abonos a su favor sin aplicar</span>
              <span className="whitespace-nowrap tabular-nums">{formatoEuros(estado.abonosPendientes)}</span>
            </div>
          )}
          <div className="mt-[1.5mm] flex items-center gap-4 bg-documento-insoluto px-[3mm] py-[2.2mm] text-[11pt] font-bold text-documento-sobre-acento">
            <span className="flex-1 tracking-[0.04em]">TOTAL INSOLUTO</span>
            <span className="whitespace-nowrap tabular-nums">{formatoEuros(estado.totalAReclamar)}</span>
          </div>
        </section>

        {estado.totalAReclamar > 0 && (
          <section className="mt-[6mm] border border-documento-borde px-[4mm] py-[2.5mm] [break-inside:avoid]">
            <Etiqueta>Forma de pago</Etiqueta>
            <p>
              Rogamos realicen el pago de las facturas insolutas
              {d.cuenta ? (
                <>
                  {" "}mediante transferencia a la cuenta <strong className="tabular-nums">{d.cuenta.iban}</strong> ({d.cuenta.banco})
                </>
              ) : (
                " por el medio habitual"
              )}
              , indicando los números de factura en el concepto. Si ya lo han abonado, no tengan en cuenta este aviso.
            </p>
          </section>
        )}

        <footer className="mt-auto pt-[8mm]">
          <div className="border-t border-documento-borde pt-[2.5mm] text-center text-[7.5pt] leading-[1.5] text-documento-tenue">
            <p className="font-semibold">{[d.empresa.nombreComercial, d.empresa.lema].filter(Boolean).join(" · ")}</p>
            {d.empresa.direccion && <p>{d.empresa.direccion.replace(/\n/g, ", ")}</p>}
            <p>{[d.empresa.telefonos, d.empresa.email].filter(Boolean).join(" · ")}</p>
          </div>
        </footer>
      </article>
    </>
  );
}
