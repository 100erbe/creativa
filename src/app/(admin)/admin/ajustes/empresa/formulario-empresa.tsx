"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { desenvolver } from "@/lib/accion";
import { guardarEmpresa } from "./acciones";

type Datos = {
  nombre_comercial: string;
  razon_social: string;
  nif: string;
  direccion: string;
  codigo_postal: string;
  municipio: string;
  provincia: string;
  telefono: string;
  movil: string;
  email: string;
  lema: string;
  validez_presupuesto_dias: number;
  vencimiento_defecto_dias: number;
  /** Actividad para los libros registro AEAT: código + tipo (p. ej. "A03") y epígrafe IAE. */
  actividad: string;
  epigrafe_iae: string;
};

/** Combinaciones de código y tipo de actividad del formato electrónico común de la AEAT. */
const ACTIVIDADES = [
  { valor: "A03", etiqueta: "A03 · Actividad empresarial (IAE)" },
  { valor: "A05", etiqueta: "A05 · Actividad profesional (IAE)" },
  { valor: "A04", etiqueta: "A04 · Actividad profesional artística o deportiva (IAE)" },
  { valor: "A01", etiqueta: "A01 · Arrendador de bienes inmuebles (IAE)" },
  { valor: "B06", etiqueta: "B06 · Otras actividades no sujetas al IAE" },
  { valor: "C", etiqueta: "C · Actividad no iniciada" },
];

const CAMPOS: { campo: Exclude<keyof Datos, "validez_presupuesto_dias" | "vencimiento_defecto_dias" | "actividad" | "epigrafe_iae">; etiqueta: string; ancho?: "completo"; tipo?: string }[] = [
  { campo: "nombre_comercial", etiqueta: "Nombre comercial *" },
  { campo: "razon_social", etiqueta: "Razón social *" },
  { campo: "nif", etiqueta: "NIF *" },
  { campo: "direccion", etiqueta: "Dirección *", ancho: "completo" },
  { campo: "codigo_postal", etiqueta: "Código postal" },
  { campo: "municipio", etiqueta: "Municipio" },
  { campo: "provincia", etiqueta: "Provincia" },
  { campo: "telefono", etiqueta: "Teléfono" },
  { campo: "movil", etiqueta: "Móvil" },
  { campo: "email", etiqueta: "Email", tipo: "email" },
  { campo: "lema", etiqueta: "Lema (debajo del logo)", ancho: "completo" },
];

export function FormularioEmpresa({ inicial }: { inicial: Datos }) {
  const router = useRouter();
  const [datos, setDatos] = useState(inicial);
  const [dias, setDias] = useState(String(inicial.validez_presupuesto_dias));
  const [vencimientoDefecto, setVencimientoDefecto] = useState(String(inicial.vencimiento_defecto_dias));
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, iniciar] = useTransition();

  return (
    <form
      className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setGuardado(false);
        iniciar(async () => {
          try {
            await desenvolver(
              guardarEmpresa({
                ...datos,
                validez_presupuesto_dias: Number(dias),
                vencimiento_defecto_dias: Number(vencimientoDefecto),
              }),
            );
            setGuardado(true);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar.");
          }
        });
      }}
    >
      <div className="grid grid-cols-1 gap-esp3 md:grid-cols-2">
        {CAMPOS.map((c) => (
          <label key={c.campo} className={`flex flex-col gap-1 ${c.ancho === "completo" ? "md:col-span-2" : ""}`}>
            <span className="text-xs font-medium text-texto-secundario">{c.etiqueta}</span>
            <input
              type={c.tipo ?? "text"}
              value={datos[c.campo]}
              onChange={(e) => setDatos({ ...datos, [c.campo]: e.target.value })}
              className={CAMPO}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-texto-secundario">Validez de un presupuesto (días)</span>
          <input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" className={CAMPO} />
          <span className="text-xs text-texto-terciario">Se usa al emitir si no pones «Válido hasta».</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-texto-secundario">Vencimiento por defecto (días)</span>
          <input
            value={vencimientoDefecto}
            onChange={(e) => setVencimientoDefecto(e.target.value)}
            inputMode="numeric"
            className={CAMPO}
          />
          <span className="text-xs text-texto-terciario">
            Se aplica si ni el documento, ni el cliente ni la forma de pago fijan otro (0 = al contado). Al
            cambiarlo se recalcula también el vencimiento de las facturas ya emitidas que lo usan.
          </span>
        </label>
      </div>
      <div className="flex flex-col gap-esp3 border-t border-borde-default pt-esp4">
        <div>
          <h2 className="text-titulo-panel text-texto-primario">Actividad (libros registro AEAT)</h2>
          <p className="text-xs text-texto-terciario">
            Se escribe en cada asiento del libro registro que se exporta desde Gastos para importarlo en Pre303 y en el
            modelo 130. El epígrafe lo encuentras en tu alta censal (modelo 036/037) o pregúntalo a tu gestor.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-esp3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-texto-secundario">Tipo de actividad</span>
            <select value={datos.actividad} onChange={(e) => setDatos({ ...datos, actividad: e.target.value })} className={CAMPO}>
              <option value="">Sin indicar</option>
              {ACTIVIDADES.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-texto-secundario">Grupo o epígrafe del IAE</span>
            <input
              value={datos.epigrafe_iae}
              onChange={(e) => setDatos({ ...datos, epigrafe_iae: e.target.value })}
              maxLength={4}
              placeholder="p. ej. 8449"
              className={CAMPO}
            />
            <span className="text-xs text-texto-terciario">Hasta 4 caracteres, sin puntos.</span>
          </label>
        </div>
      </div>
      {error && <p className="text-sm text-texto-peligro">{error}</p>}
      <div className="flex items-center gap-esp3">
        <Boton type="submit" cargando={pendiente}>
          Guardar
        </Boton>
        {guardado && !error && (
          <span className="text-sm text-texto-exito" role="status">
            Guardado
          </span>
        )}
      </div>
    </form>
  );
}
