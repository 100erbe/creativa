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
};

const CAMPOS: { campo: Exclude<keyof Datos, "validez_presupuesto_dias">; etiqueta: string; ancho?: "completo"; tipo?: string }[] = [
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
            await desenvolver(guardarEmpresa({ ...datos, validez_presupuesto_dias: Number(dias) }));
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
