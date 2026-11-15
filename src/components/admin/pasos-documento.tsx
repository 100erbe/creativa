import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icono } from "@/components/ui/iconos";

type Paso = { numero: number; etiqueta: string; ruta: (id: number) => string };

const PASOS: Paso[] = [
  { numero: 1, etiqueta: "Cliente", ruta: (id) => `/admin/documentos/nuevo?documento=${id}&paso=cliente` },
  { numero: 2, etiqueta: "Artículos", ruta: (id) => `/admin/documentos/nuevo?documento=${id}` },
  { numero: 3, etiqueta: "Campaña", ruta: (id) => `/admin/documentos/nuevo?documento=${id}&paso=campana` },
  { numero: 4, etiqueta: "Revisar y emitir", ruta: (id) => `/admin/documentos/${id}` },
];

/** Indicador de pasos del asistente. Con `documentoId` cada paso es un enlace. */
export function PasosDocumento({ actual, documentoId }: { actual: number; documentoId?: number }) {
  const pasoActual = PASOS.find((p) => p.numero === actual);
  return (
    <>
      {/* Móvil: "Paso 2 de 4" + barra de 4 segmentos (los pasos hechos son enlaces). */}
      <div className="flex flex-col gap-esp2 md:hidden">
        <p className="text-sm font-medium text-texto-primario">
          Paso {actual} de {PASOS.length} · <span className="text-texto-marca">{pasoActual?.etiqueta}</span>
        </p>
        <div className="flex gap-1.5">
          {PASOS.map((paso) => {
            const barra = (
              <span
                className={cn(
                  "block h-2 rounded-completo",
                  paso.numero < actual && "bg-borde-exito",
                  paso.numero === actual && "bg-fondo-marca",
                  paso.numero > actual && "bg-fondo-hover",
                )}
              />
            );
            return documentoId && paso.numero !== actual ? (
              <Link key={paso.numero} href={paso.ruta(documentoId)} aria-label={paso.etiqueta} className="flex-1 py-2">
                {barra}
              </Link>
            ) : (
              <span key={paso.numero} className="flex-1 py-2">
                {barra}
              </span>
            );
          })}
        </div>
      </div>
    <div className="hidden flex-wrap items-center gap-esp3 md:flex">
      {PASOS.map((paso, i) => {
        const estado = paso.numero < actual ? "hecho" : paso.numero === actual ? "actual" : "pendiente";
        const contenido = (
          <div className="flex items-center gap-esp2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-completo text-xs font-medium",
                estado === "hecho" && "border border-borde-exito bg-fondo-exito-sutil text-texto-exito",
                estado === "actual" && "bg-fondo-marca text-texto-sobre-marca",
                estado === "pendiente" && "border border-borde-fuerte bg-fondo-superficie text-texto-terciario",
              )}
            >
              {estado === "hecho" ? <Icono nombre="check" size={14} /> : paso.numero}
            </div>
            <span
              className={cn(
                "text-sm",
                estado === "pendiente" ? "text-texto-terciario" : "text-texto-primario",
                estado === "actual" && "font-medium",
              )}
            >
              {paso.etiqueta}
            </span>
          </div>
        );
        return (
          <div key={paso.numero} className="flex items-center gap-esp3">
            {documentoId && estado !== "actual" ? (
              <Link href={paso.ruta(documentoId)} className="rounded-md hover:opacity-80">
                {contenido}
              </Link>
            ) : (
              contenido
            )}
            {i < PASOS.length - 1 && (
              <div
                className={cn(
                  "hidden h-0.5 w-10 rounded-completo sm:block",
                  estado === "hecho" ? "bg-borde-exito" : "bg-fondo-hover",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
    </>
  );
}
