"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { desenvolver } from "@/lib/accion";
import { eliminarFormaPago, guardarCuenta, guardarFormaPago } from "./acciones";
import { confirmar } from "@/components/ui/dialogos";
import { useAccion } from "@/lib/use-accion";

const etiqueta = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";

// ---------------------------------------------------------------------
//  Formas de pago
// ---------------------------------------------------------------------

type Forma = { id: number; nombre: string; dias_vencimiento: number; texto_factura: string | null };

export function FormasPago({ formas }: { formas: Forma[] }) {
  const [editando, setEditando] = useState<number | "nueva" | null>(null);
  return (
    <div className="flex flex-col gap-esp2">
      <div className="flex flex-col divide-y divide-borde-default">
        {formas.map((f) =>
          editando === f.id ? (
            <FormularioForma key={f.id} forma={f} onCerrar={() => setEditando(null)} />
          ) : (
            <div key={f.id} className="flex items-start gap-esp3 py-esp3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-texto-primario">{f.nombre}</p>
                <p className="text-xs text-texto-terciario">
                  Vence a {f.dias_vencimiento} día{f.dias_vencimiento === 1 ? "" : "s"}
                  {f.texto_factura ? ` · «${f.texto_factura}»` : ""}
                </p>
              </div>
              <button onClick={() => setEditando(f.id)} className="text-sm font-medium text-texto-marca">
                Editar
              </button>
            </div>
          ),
        )}
        {formas.length === 0 && <p className="py-esp3 text-sm text-texto-terciario">Todavía no hay formas de pago.</p>}
      </div>
      {editando === "nueva" ? (
        <FormularioForma onCerrar={() => setEditando(null)} />
      ) : (
        <Boton variante="secundario" tamano="s" className="w-fit" onClick={() => setEditando("nueva")}>
          <Icono nombre="mas" size={14} />
          Añadir forma de pago
        </Boton>
      )}
    </div>
  );
}

function FormularioForma({ forma, onCerrar }: { forma?: Forma; onCerrar: () => void }) {
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  const [nombre, setNombre] = useState(forma?.nombre ?? "");
  const [dias, setDias] = useState(String(forma?.dias_vencimiento ?? 0));
  const [texto, setTexto] = useState(forma?.texto_factura ?? "");

  return (
    <form
      className="flex flex-col gap-esp3 rounded-md border border-borde-foco bg-fondo-superficie p-esp3"
      onSubmit={(e) => {
        e.preventDefault();
        ejecutar(async () => {
          await desenvolver(guardarFormaPago(forma?.id ?? null, { nombre, diasVencimiento: Number(dias), textoFactura: texto }));
          onCerrar();
        });
      }}
    >
      <div className="grid grid-cols-[1fr_100px] gap-esp3">
        <label className={etiqueta}>
          Nombre *
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className={CAMPO} />
        </label>
        <label className={etiqueta}>
          Días
          <input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" className={CAMPO} />
        </label>
      </div>
      <label className={etiqueta}>
        Texto en el documento
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej. Pago por transferencia a 30 días"
          className={CAMPO}
        />
      </label>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
      <div className="flex flex-wrap items-center gap-esp2">
        <Boton type="submit" tamano="s" cargando={pendiente}>
          Guardar
        </Boton>
        <Boton type="button" tamano="s" variante="secundario" onClick={onCerrar} disabled={pendiente}>
          Cancelar
        </Boton>
        {forma && (
          <button
            type="button"
            disabled={pendiente}
            onClick={async () => {
              if (!(await confirmar(`¿Eliminar «${forma.nombre}»?`))) return;
              ejecutar(async () => {
                await desenvolver(eliminarFormaPago(forma.id));
                onCerrar();
              });
            }}
            className="ml-auto text-xs font-medium text-texto-secundario hover:text-texto-peligro disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
//  Cuentas bancarias
// ---------------------------------------------------------------------

type Cuenta = { id: number; banco: string; iban: string; por_defecto: boolean; activa: boolean };

export function Cuentas({ cuentas }: { cuentas: Cuenta[] }) {
  const [editando, setEditando] = useState<number | "nueva" | null>(null);
  return (
    <div className="flex flex-col gap-esp2">
      <div className="flex flex-col divide-y divide-borde-default">
        {cuentas.map((c) =>
          editando === c.id ? (
            <FormularioCuenta key={c.id} cuenta={c} onCerrar={() => setEditando(null)} />
          ) : (
            <div key={c.id} className="flex items-start gap-esp3 py-esp3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-texto-primario">
                  {c.banco}
                  {c.por_defecto && <span className="ml-esp2 text-xs font-normal text-texto-exito">por defecto</span>}
                  {!c.activa && <span className="ml-esp2 text-xs font-normal text-texto-terciario">inactiva</span>}
                </p>
                <p className="break-all text-xs text-texto-terciario">{c.iban}</p>
              </div>
              <button onClick={() => setEditando(c.id)} className="text-sm font-medium text-texto-marca">
                Editar
              </button>
            </div>
          ),
        )}
        {cuentas.length === 0 && <p className="py-esp3 text-sm text-texto-terciario">Todavía no hay cuentas.</p>}
      </div>
      {editando === "nueva" ? (
        <FormularioCuenta onCerrar={() => setEditando(null)} />
      ) : (
        <Boton variante="secundario" tamano="s" className="w-fit" onClick={() => setEditando("nueva")}>
          <Icono nombre="mas" size={14} />
          Añadir cuenta
        </Boton>
      )}
    </div>
  );
}

function FormularioCuenta({ cuenta, onCerrar }: { cuenta?: Cuenta; onCerrar: () => void }) {
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  const [banco, setBanco] = useState(cuenta?.banco ?? "");
  const [iban, setIban] = useState(cuenta?.iban ?? "");
  const [porDefecto, setPorDefecto] = useState(cuenta?.por_defecto ?? false);
  const [activa, setActiva] = useState(cuenta?.activa ?? true);

  return (
    <form
      className="flex flex-col gap-esp3 rounded-md border border-borde-foco bg-fondo-superficie p-esp3"
      onSubmit={(e) => {
        e.preventDefault();
        ejecutar(async () => {
          await desenvolver(guardarCuenta(cuenta?.id ?? null, { banco, iban, porDefecto, activa }));
          onCerrar();
        });
      }}
    >
      <label className={etiqueta}>
        Banco *
        <input value={banco} onChange={(e) => setBanco(e.target.value)} required className={CAMPO} />
      </label>
      <label className={etiqueta}>
        IBAN *
        <input value={iban} onChange={(e) => setIban(e.target.value)} required className={CAMPO} />
      </label>
      <div className="flex flex-wrap gap-esp4 text-sm text-texto-primario">
        <label className="flex items-center gap-esp2">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
          Activa
        </label>
        <label className="flex items-center gap-esp2">
          <input type="checkbox" checked={porDefecto} onChange={(e) => setPorDefecto(e.target.checked)} />
          Por defecto
        </label>
      </div>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
      <div className="flex gap-esp2">
        <Boton type="submit" tamano="s" cargando={pendiente}>
          Guardar
        </Boton>
        <Boton type="button" tamano="s" variante="secundario" onClick={onCerrar} disabled={pendiente}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
