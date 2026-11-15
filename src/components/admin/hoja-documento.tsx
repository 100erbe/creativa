// Hoja A4 de un documento (factura, presupuesto, albarán, rectificativa, recibo).
// Componente de presentación puro: recibe los datos ya preparados, para usarlo igual
// en la página de impresión real y en pruebas.

import { ETIQUETA_ALCANCE, ETIQUETA_TIPO } from "@/lib/documentos";
import { fechaNumerica } from "@/lib/formato";
import {
  desgloseIva,
  formatoCantidad,
  formatoEuros,
  formatoImporte,
  precioUnitarioImpreso,
} from "@/lib/documento-impresion";

const UNIDAD: Record<string, string> = {
  ud: "ud",
  m2: "m²",
  ml: "ml",
  millar: "millar",
  mes: "mes",
  servicio: "serv.",
  km: "km",
};

export type LineaHoja = {
  id: number | string;
  descripcion: string;
  artista?: string | null;
  alcance: string | null;
  unidad: string;
  piezas: number | string;
  cantidad: number | string;
  ancho_cm: number | string | null;
  alto_cm: number | string | null;
  precio_unitario: number | string;
  recargo_acabados: number | string | null;
  descuento_pct: number | string;
  iva_pct: number | string;
  importe: number | string;
};

export type DatosHoja = {
  tipo: string;
  estado: string;
  numero: string | null;
  fecha: string;
  fechaOperacion: string | null;
  fechaVencimiento: string | null;
  validoHasta: string | null;
  empresa: {
    nombreComercial: string | null;
    razonSocial: string | null;
    nif: string | null;
    direccion: string;
    telefonos: string;
    email: string | null;
    lema: string | null;
    logoPrincipal: string;
    logoSecundario: string | null;
  };
  cliente: { razonSocial: string; documento: string | null; direccion: string };
  campana: string | null;
  descripcion: string | null;
  rectifica: { numero: string | null; fecha: string } | null;
  motivoRectificacion: string | null;
  lineas: LineaHoja[];
  totales: {
    suma: number;
    descuentoPct: number;
    descuentoImporte: number;
    base: number;
    cuota: number;
    retencionPct: number;
    retencionImporte: number;
    total: number;
  };
  regimenIva: string;
  motivoExencion: string | null;
  pago: { texto: string | null; banco: string | null; iban: string | null };
  notasCliente: string | null;
  /** Sello «PAGADA» (solo facturas cobradas por completo, y solo si se pide). */
  pagada?: { fecha: string | null; metodo: string | null } | null;
};

const AZUL = "text-[#425d90]";

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <p className={`mb-1 text-[7.5pt] font-semibold uppercase tracking-[0.09em] ${AZUL}`}>{children}</p>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[7pt] font-semibold uppercase tracking-[0.08em] text-neutral-500">{etiqueta}</span>
      <span className="text-[9.5pt] font-medium">{valor}</span>
    </div>
  );
}

function FilaTotal({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex gap-4 py-[1.2mm] text-[9.5pt]">
      <span className="flex-1 text-neutral-600">{etiqueta}</span>
      <span className="whitespace-nowrap tabular-nums">{valor}</span>
    </div>
  );
}

export function HojaDocumento({ d }: { d: DatosHoja }) {
  const esBorrador = d.estado === "borrador";
  const esFactura = d.tipo === "factura" || d.tipo === "rectificativa";
  const esPresupuesto = d.tipo === "presupuesto";
  const esAlbaran = d.tipo === "albaran";
  const esRecibo = d.tipo === "recibo";
  const sinIva = d.regimenIva === "exento" || d.regimenIva === "intracomunitario";

  const desglose = desgloseIva(d.lineas, d.totales.descuentoPct, sinIva);
  const variosTipos = desglose.length > 1;
  const hayAlcance = d.lineas.some((l) => l.alcance);
  const hayDescuento = d.lineas.some((l) => Number(l.descuento_pct) > 0);
  const mismaOperacion = !d.fechaOperacion || d.fechaOperacion === d.fecha;

  const tituloTipo = (ETIQUETA_TIPO[d.tipo] ?? d.tipo).toUpperCase();
  // Columnas de la tabla: concepto + (alcance) + cantidad + precio + (dto) + (iva) + importe
  const columnas = 4 + (hayAlcance ? 1 : 0) + (hayDescuento ? 1 : 0) + (variosTipos ? 1 : 0);

  return (
    <>
      {/* Tamaño de página, márgenes y numeración. Los colores de fondo se imprimen tal cual. */}
      <style>{`
        @page { size: A4; margin: 14mm 18mm 18mm 18mm;
          @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.5pt Arial, Helvetica, sans-serif; color: #6b7280; } }
        .hoja-documento, .hoja-documento * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { html, body { background: #fff !important; } }
      `}</style>

      <article
        className="hoja-documento mx-auto flex w-[210mm] max-w-none flex-col bg-white px-[18mm] pb-[16mm] pt-[14mm] text-[9.5pt] leading-[1.4] text-neutral-900 shadow-sm ring-1 ring-black/10 min-h-[297mm] print:min-h-[262mm] print:w-auto print:p-0 print:shadow-none print:ring-0"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        {esBorrador && (
          <p className="mb-4 border border-amber-400 bg-amber-50 px-3 py-1.5 text-center text-[8pt] font-bold tracking-[0.12em] text-amber-800">
            BORRADOR · SIN NÚMERO NI VALIDEZ HASTA QUE SE EMITA
          </p>
        )}

        {/* Cabecera: logos a la izquierda, tipo y número a la derecha */}
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-[5mm]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.empresa.logoPrincipal} alt={d.empresa.nombreComercial ?? "Logo"} className="h-[13mm] w-auto" />
            {d.empresa.logoSecundario && (
              <>
                <span className="h-[10mm] w-px bg-neutral-300" aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.empresa.logoSecundario} alt="Crea Comunicación" className="h-[12mm] w-auto" />
              </>
            )}
          </div>
          <div className="text-right">
            <p className={`text-[21pt] font-bold leading-none tracking-[0.04em] ${AZUL}`}>{tituloTipo}</p>
            <p className="mt-[1.5mm] text-[11pt] font-bold">Nº {d.numero ?? "—"}</p>
          </div>
        </header>

        <div className="mt-[4mm] h-[0.7mm] bg-[#425d90]" />

        {/* Fechas */}
        <div className="mt-[3mm] flex flex-wrap gap-x-[10mm] gap-y-2 bg-neutral-100 px-[4mm] py-[2.5mm]">
          <Dato etiqueta="Fecha" valor={fechaNumerica(d.fecha)} />
          {!mismaOperacion && d.fechaOperacion && (
            <Dato etiqueta="Fecha de la operación" valor={fechaNumerica(d.fechaOperacion)} />
          )}
          {d.fechaVencimiento && !esBorrador && d.tipo === "factura" && (
            <Dato etiqueta="Vencimiento" valor={fechaNumerica(d.fechaVencimiento)} />
          )}
          {d.validoHasta && <Dato etiqueta="Válido hasta" valor={fechaNumerica(d.validoHasta)} />}
          {d.tipo === "rectificativa" && d.rectifica && (
            <Dato
              etiqueta="Rectifica la factura"
              valor={`${d.rectifica.numero ?? "—"} · ${fechaNumerica(d.rectifica.fecha)}`}
            />
          )}
        </div>

        {/* Emisor y cliente */}
        <section className="mt-[6mm] grid grid-cols-2">
          <div className="pr-[6mm]">
            <Etiqueta>Emisor</Etiqueta>
            <p className="text-[10pt] font-bold">{d.empresa.razonSocial ?? d.empresa.nombreComercial}</p>
            {d.empresa.nif && <p>NIF {d.empresa.nif}</p>}
            {d.empresa.direccion && <p className="whitespace-pre-line">{d.empresa.direccion}</p>}
          </div>
          <div className="border-l border-neutral-300 pl-[6mm]">
            <Etiqueta>{esAlbaran ? "Destinatario" : "Cliente"}</Etiqueta>
            <p className="text-[10pt] font-bold">{d.cliente.razonSocial || "—"}</p>
            {d.cliente.documento && <p>{d.cliente.documento}</p>}
            {d.cliente.direccion && <p className="whitespace-pre-line">{d.cliente.direccion}</p>}
          </div>
        </section>

        {/* Concepto general */}
        {!esRecibo && (d.campana || d.descripcion || d.motivoRectificacion) && (
          <section className="mt-[5mm] border border-neutral-300 px-[4mm] py-[2.5mm]">
            <Etiqueta>{d.tipo === "rectificativa" ? "Motivo de la rectificación" : "Concepto"}</Etiqueta>
            {d.campana && <p className="font-semibold">Campaña: {d.campana}</p>}
            {d.motivoRectificacion ? <p>{d.motivoRectificacion}</p> : d.descripcion && <p>{d.descripcion}</p>}
          </section>
        )}

        {/* Recibo: frase habitual */}
        {esRecibo && (
          <p className="mt-[5mm] text-[10.5pt]">
            Recibí de <strong>{d.cliente.razonSocial}</strong> la cantidad de{" "}
            <strong>{formatoEuros(d.totales.total)}</strong>
            {d.descripcion ? <> en concepto de {d.descripcion}</> : null}.
          </p>
        )}

        {/* Líneas */}
        <table className="mt-[6mm] w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#425d90] text-[7.5pt] uppercase tracking-[0.06em] text-white">
              <th className="w-full px-[2.5mm] py-[2mm] font-semibold">Descripción</th>
              {hayAlcance && <th className="px-[2mm] py-[2mm] whitespace-nowrap font-semibold">Servicio</th>}
              <th className="px-[2mm] py-[2mm] text-right whitespace-nowrap font-semibold">Cant.</th>
              <th className="px-[2mm] py-[2mm] text-right whitespace-nowrap font-semibold">Precio (€)</th>
              {hayDescuento && <th className="px-[2mm] py-[2mm] text-right whitespace-nowrap font-semibold">Dto.</th>}
              {variosTipos && <th className="px-[2mm] py-[2mm] text-right whitespace-nowrap font-semibold">IVA</th>}
              <th className="whitespace-nowrap px-[2.5mm] py-[2mm] text-right font-semibold">Importe (€)</th>
            </tr>
          </thead>
          <tbody>
            {d.lineas.map((l) => {
              const conMedidas = (l.unidad === "m2" || l.unidad === "ml") && l.ancho_cm != null;
              return (
                <tr key={l.id} className="border-b border-neutral-200 align-top [break-inside:avoid]">
                  <td className="px-[2.5mm] py-[2mm]">
                    <p>{l.descripcion}</p>
                    {l.artista && <p className="text-[8.5pt] font-medium text-neutral-700">{l.artista}</p>}
                    {conMedidas && (
                      <p className="text-[8pt] text-neutral-500">
                        {formatoCantidad(l.piezas)} ud
                        {l.alto_cm != null ? ` · ${formatoCantidad(l.ancho_cm ?? 0)} × ${formatoCantidad(l.alto_cm)} cm` : ""}
                      </p>
                    )}
                  </td>
                  {hayAlcance && (
                    <td className="whitespace-nowrap px-[2mm] py-[2mm] text-[8.5pt] text-neutral-700">
                      {l.alcance ? (ETIQUETA_ALCANCE[l.alcance] ?? l.alcance) : ""}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-[2mm] py-[2mm] text-right tabular-nums">
                    {formatoCantidad(l.cantidad)} {UNIDAD[l.unidad] ?? l.unidad}
                  </td>
                  <td className="whitespace-nowrap px-[2mm] py-[2mm] text-right tabular-nums">
                    {formatoImporte(precioUnitarioImpreso(l))}
                  </td>
                  {hayDescuento && (
                    <td className="whitespace-nowrap px-[2mm] py-[2mm] text-right tabular-nums">
                      {Number(l.descuento_pct) > 0 ? `${formatoCantidad(l.descuento_pct)} %` : ""}
                    </td>
                  )}
                  {variosTipos && (
                    <td className="whitespace-nowrap px-[2mm] py-[2mm] text-right tabular-nums">
                      {sinIva ? "0 %" : `${formatoCantidad(l.iva_pct)} %`}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-[2.5mm] py-[2mm] text-right font-semibold tabular-nums">
                    {formatoImporte(l.importe)}
                  </td>
                </tr>
              );
            })}
            {d.lineas.length === 0 && (
              <tr>
                <td colSpan={columnas} className="px-[2.5mm] py-[4mm] text-neutral-500">
                  Este documento no tiene líneas.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pago a la izquierda, totales a la derecha */}
        <section className="mt-[6mm] grid grid-cols-[1fr_72mm] gap-[8mm] [break-inside:avoid]">
          <div className="flex flex-col gap-[4mm]">
            {d.pagada && (
              <div
                className="ml-[4mm] mt-[1mm] w-fit -rotate-6 rounded-[1.5mm] border-[0.7mm] border-double border-[#15803d] px-[5mm] py-[1.5mm] text-center text-[#15803d]"
                aria-label="Factura pagada"
              >
                <p className="text-[20pt] font-bold leading-none tracking-[0.18em]">PAGADA</p>
                {(d.pagada.fecha || d.pagada.metodo) && (
                  <p className="mt-[1mm] text-[8pt] font-semibold tracking-[0.04em]">
                    {[d.pagada.fecha ? fechaNumerica(d.pagada.fecha) : null, d.pagada.metodo].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            )}
            {(d.pago.texto || d.pago.iban) && (d.tipo === "factura" || esPresupuesto || esRecibo) && (
              <div>
                <Etiqueta>Forma de pago</Etiqueta>
                {d.pago.texto && <p>{d.pago.texto}</p>}
                {!esRecibo && d.pago.banco && <p>{d.pago.banco}</p>}
                {!esRecibo && d.pago.iban && (
                  <p>
                    IBAN <span className="font-semibold tabular-nums">{d.pago.iban}</span>
                  </p>
                )}
              </div>
            )}
            {sinIva && d.motivoExencion && (
              <div className="border border-neutral-300 px-[3mm] py-[2mm] text-[8.5pt]">{d.motivoExencion}</div>
            )}
            {d.notasCliente && <p className="text-[8.5pt] text-neutral-700">{d.notasCliente}</p>}
          </div>

          <div>
            {d.totales.descuentoImporte !== 0 && (
              <>
                <FilaTotal etiqueta="Suma" valor={formatoEuros(d.totales.suma)} />
                <FilaTotal
                  etiqueta={`Descuento ${formatoCantidad(d.totales.descuentoPct)} %`}
                  valor={formatoEuros(-d.totales.descuentoImporte)}
                />
              </>
            )}
            <div className="border-t border-neutral-300">
              <FilaTotal etiqueta="Base imponible" valor={formatoEuros(d.totales.base)} />
              {desglose.map((x) => (
                <FilaTotal
                  key={x.tipo}
                  etiqueta={sinIva ? "IVA 0 % (sin IVA)" : variosTipos ? `IVA ${formatoCantidad(x.tipo)} % s/ ${formatoImporte(x.base)}` : `IVA ${formatoCantidad(x.tipo)} %`}
                  valor={formatoEuros(x.cuota)}
                />
              ))}
              {d.totales.retencionImporte !== 0 && (
                <FilaTotal
                  etiqueta={`Retención IRPF ${formatoCantidad(d.totales.retencionPct)} %`}
                  valor={formatoEuros(-d.totales.retencionImporte)}
                />
              )}
            </div>
            <div className="mt-[1.5mm] flex items-center gap-4 bg-[#425d90] px-[3mm] py-[2.2mm] text-[11pt] font-bold text-white">
              <span className="flex-1 tracking-[0.06em]">TOTAL</span>
              <span className="whitespace-nowrap tabular-nums">{formatoEuros(d.totales.total)}</span>
            </div>
          </div>
        </section>

        {/* Firmas según el tipo de documento */}
        {esPresupuesto && (
          <section className="mt-[8mm] grid h-[28mm] grid-cols-2 gap-[8mm] [break-inside:avoid]">
            <p className="text-[8.5pt] text-neutral-600">
              Para aceptar este presupuesto, devuélvalo firmado y sellado dentro del plazo de validez.
            </p>
            <div className="border border-neutral-400 px-[3mm] py-[2mm]">
              <p className={`text-[7.5pt] font-semibold uppercase tracking-[0.09em] ${AZUL}`}>Conforme del cliente</p>
              <p className="mt-[2mm] text-[8pt] text-neutral-500">Fecha, firma y sello</p>
            </div>
          </section>
        )}
        {esRecibo && (
          <section className="ml-auto mt-[8mm] h-[28mm] w-[85mm] border border-neutral-400 px-[3mm] py-[2mm] [break-inside:avoid]">
            <p className={`text-[7.5pt] font-semibold uppercase tracking-[0.09em] ${AZUL}`}>Firma y sello del emisor</p>
          </section>
        )}
        {esAlbaran && (
          <section className="mt-[8mm] h-[28mm] w-[85mm] border border-neutral-400 px-[3mm] py-[2mm] [break-inside:avoid]">
            <p className={`text-[7.5pt] font-semibold uppercase tracking-[0.09em] ${AZUL}`}>Recibí conforme</p>
            <p className="mt-[2mm] text-[8pt] text-neutral-500">Nombre, fecha y firma</p>
          </section>
        )}

        {/* Pie: datos de contacto del emisor, siempre abajo */}
        <footer className="mt-auto pt-[8mm]">
          <div className="border-t border-neutral-300 pt-[2.5mm] text-center text-[7.5pt] leading-[1.5] text-neutral-600">
            <p className="font-semibold">
              {[d.empresa.nombreComercial, d.empresa.lema].filter(Boolean).join(" · ")}
            </p>
            {d.empresa.direccion && <p>{d.empresa.direccion.replace(/\n/g, ", ")}</p>}
            <p>{[d.empresa.telefonos, d.empresa.email].filter(Boolean).join(" · ")}</p>
          </div>
        </footer>
      </article>
    </>
  );
}
