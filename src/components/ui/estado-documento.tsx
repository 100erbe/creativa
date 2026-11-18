"use client";

import { Icono, type NombreIcono } from "@/components/ui/iconos";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

// Insignia redonda de estado del documento ("Documents / Document status" de Figma):
// círculo 44×44 con el icono del estado; al pasar el ratón, enfocar o tocar muestra el estado en un tooltip.
// Colores en src/design/tokens.ts → estadoDocumento (mismos valores en las clases de abajo).

type Visual = "emitido" | "borrador" | "enviado" | "anulado" | "pagado" | "pendiente" | "vencido";

const ESTILO: Record<Visual, { fondo: string; icono: string; nombre: NombreIcono }> = {
  emitido: { fondo: "bg-fondo-marca-sutil", icono: "text-base-amber", nombre: "estadoEmitido" },
  borrador: { fondo: "bg-fondo-hover", icono: "text-base-gray", nombre: "estadoBorrador" },
  enviado: { fondo: "bg-fondo-info-sutil", icono: "text-texto-info", nombre: "estadoEnviado" },
  anulado: { fondo: "bg-fondo-peligro-sutil", icono: "text-texto-peligro", nombre: "estadoAnulado" },
  pagado: { fondo: "bg-fondo-exito-sutil", icono: "text-texto-exito", nombre: "estadoPagado" },
  pendiente: { fondo: "bg-fondo-aviso-sutil", icono: "text-texto-aviso", nombre: "estadoPendiente" },
  vencido: { fondo: "bg-fondo-peligro-sutil", icono: "text-texto-peligro", nombre: "estadoPendiente" },
};

/** Estado de negocio (documento o cobro) → aspecto y texto del tooltip. */
const ESTADOS: Record<string, { visual: Visual; texto: string }> = {
  borrador: { visual: "borrador", texto: "Documento borrador" },
  emitido: { visual: "emitido", texto: "Documento emitido" },
  enviado: { visual: "enviado", texto: "Documento enviado" },
  aceptado: { visual: "pagado", texto: "Presupuesto aceptado" },
  facturado: { visual: "pagado", texto: "Presupuesto facturado" },
  rechazado: { visual: "anulado", texto: "Presupuesto rechazado" },
  caducado: { visual: "borrador", texto: "Presupuesto caducado" },
  sustituido: { visual: "borrador", texto: "Versión sustituida" },
  anulado: { visual: "anulado", texto: "Documento anulado" },
  // Estados de cobro (facturas emitidas)
  cobrada: { visual: "pagado", texto: "Factura cobrada" },
  pagada: { visual: "pagado", texto: "Factura cobrada" },
  pendiente: { visual: "pendiente", texto: "Pendiente de cobro" },
  parcial: { visual: "pendiente", texto: "Cobro parcial" },
  vencida: { visual: "vencido", texto: "Factura vencida" },
};

export function textoEstadoDocumento(estado: string) {
  return ESTADOS[estado]?.texto ?? estado;
}

export function EstadoDocumento({
  estado,
  texto,
  tamano = "m",
  className,
}: {
  /** Estado del documento (borrador, emitido…) o de cobro (pendiente, vencida, cobrada…). */
  estado: string;
  /** Texto del tooltip si se quiere otro (p. ej. «Vencida hace 92 días»). */
  texto?: string;
  /** m = 44 px (Figma); s = 32 px (tablas densas). */
  tamano?: "m" | "s";
  className?: string;
}) {
  const info = ESTADOS[estado] ?? { visual: "borrador" as Visual, texto: estado };
  const estilo = ESTILO[info.visual];
  const etiqueta = texto ?? info.texto;
  return (
    <Tooltip texto={etiqueta} alineacion="fin" className={className}>
      <button
        type="button"
        aria-label={`Estado: ${etiqueta}`}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-completo transition-transform duration-rapida ease-salida active:scale-press",
          tamano === "m" ? "h-11 w-11" : "h-8 w-8",
          estilo.fondo,
          estilo.icono,
        )}
      >
        <Icono nombre={estilo.nombre} size={tamano === "m" ? 20 : 16} />
      </button>
    </Tooltip>
  );
}
