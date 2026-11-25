"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { cn } from "@/lib/cn";
import { atraparFoco } from "@/lib/trampa-foco";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

function parsearFecha(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]) - 1;
  const dia = Number(m[3]);
  const fecha = new Date(ano, mes, dia);
  if (fecha.getFullYear() !== ano || fecha.getMonth() !== mes || fecha.getDate() !== dia) return null;
  return fecha;
}

function aIso(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatearVisible(valor: string): string {
  const f = parsearFecha(valor);
  if (!f) return "";
  return `${f.getDate()} ${MESES_CORTOS[f.getMonth()]} ${f.getFullYear()}`;
}

function hoyIso(): string {
  return aIso(new Date());
}

/**
 * Selector de fecha unificado con calendario visual en portal (funciona igual en desktop y móvil
 * sin depender de los iconos nativos de `<input type="date">`, que varían según el navegador).
 */
export function SelectorFecha({
  value,
  onChange,
  min,
  name,
  placeholder = "dd/mm/aaaa",
  disabled = false,
  className,
}: {
  value: string;
  onChange: (valor: string) => void;
  min?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [vistaMes, setVistaMes] = useState<{ ano: number; mes: number }>(() => {
    const base = parsearFecha(value) ?? parsearFecha(min ?? "") ?? new Date();
    return { ano: base.getFullYear(), mes: base.getMonth() };
  });
  const titleId = useId();

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAbierto(false);
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  function abrir() {
    if (disabled) return;
    const base = parsearFecha(value) ?? parsearFecha(min ?? "") ?? new Date();
    setVistaMes({ ano: base.getFullYear(), mes: base.getMonth() });
    setAbierto(true);
  }

  function cambiarMes(delta: number) {
    setVistaMes(({ ano, mes }) => {
      const nueva = new Date(ano, mes + delta, 1);
      return { ano: nueva.getFullYear(), mes: nueva.getMonth() };
    });
  }

  const hoy = hoyIso();
  const minVal = min && parsearFecha(min) ? min : undefined;
  const texto = formatearVisible(value);

  // Construimos las 42 celdas empezando en lunes.
  const primerDia = new Date(vistaMes.ano, vistaMes.mes, 1);
  const desplazamiento = (primerDia.getDay() + 6) % 7;
  const inicioCuadricula = new Date(vistaMes.ano, vistaMes.mes, 1 - desplazamiento);
  const celdas = Array.from({ length: 42 }, (_, idx) => {
    const d = new Date(inicioCuadricula.getFullYear(), inicioCuadricula.getMonth(), inicioCuadricula.getDate() + idx);
    const iso = aIso(d);
    return {
      iso,
      dia: d.getDate(),
      delMes: d.getMonth() === vistaMes.mes,
      deshabilitado: Boolean(minVal && iso < minVal),
      esHoy: iso === hoy,
      seleccionado: iso === value,
    };
  });

  const hoyDeshabilitado = Boolean(minVal && hoy < minVal);

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        disabled={disabled}
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={cn(
          CAMPO,
          "flex items-center justify-between gap-1.5 px-esp2.5 text-left text-sm",
          texto ? "text-texto-primario" : "text-texto-terciario",
          className,
        )}
      >
        <span className="min-w-0 truncate">{texto || placeholder}</span>
        <Icono nombre="calendario" size={16} className="shrink-0 text-icono-default" />
      </button>

      {montado &&
        abierto &&
        createPortal(
          <div
            data-selector-fecha=""
            className="fixed inset-0 z-[10020] flex items-end justify-center p-0 sm:items-center sm:p-esp4"
            role="presentation"
          >
            <button
              type="button"
              aria-label="Cerrar calendario"
              tabIndex={-1}
              onClick={() => setAbierto(false)}
              className="animate-velo-entrar absolute inset-0 cursor-default bg-fondo-velo"
            />
            <div ref={atraparFoco}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="animate-hoja-subir sm:animate-modal-entrar relative flex w-full flex-col gap-esp3 rounded-t-2xl border border-borde-default bg-fondo-superficie p-esp4 shadow-elevado sm:max-w-xs sm:rounded-xl"
            >
              <div className="flex items-center justify-between gap-esp2">
                <button
                  type="button"
                  aria-label="Mes anterior"
                  onClick={() => cambiarMes(-1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-borde-default bg-fondo-superficie text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
                >
                  <Icono nombre="chevron" size={16} className="rotate-180" />
                </button>
                <p id={titleId} className="text-sm font-semibold capitalize text-texto-primario">
                  {MESES[vistaMes.mes]} {vistaMes.ano}
                </p>
                <button
                  type="button"
                  aria-label="Mes siguiente"
                  onClick={() => cambiarMes(1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-borde-default bg-fondo-superficie text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
                >
                  <Icono nombre="chevron" size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {DIAS_SEMANA.map((d) => (
                  <span key={d} className="py-1 text-etiqueta font-semibold text-texto-terciario">
                    {d}
                  </span>
                ))}
                {celdas.map((c) => (
                  <button
                    key={c.iso}
                    type="button"
                    disabled={c.deshabilitado}
                    onClick={() => {
                      onChange(c.iso);
                      setAbierto(false);
                    }}
                    className={cn(
                      "flex h-11 w-full items-center justify-center rounded-lg text-sm tabular-nums transition-colors duration-rapida ease-suave active:scale-press disabled:cursor-not-allowed disabled:opacity-35",
                      c.seleccionado
                        ? "bg-fondo-marca font-semibold text-texto-sobre-marca"
                        : c.esHoy
                          ? "border border-borde-foco font-semibold text-texto-marca hover:bg-fondo-marca-sutil"
                          : c.delMes
                            ? "text-texto-primario hover:bg-fondo-sutil"
                            : "text-texto-terciario hover:bg-fondo-sutil",
                    )}
                  >
                    {c.dia}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-esp2 border-t border-borde-default pt-esp2">
                <div className="flex gap-esp2">
                  {value && (
                    <Boton
                      type="button"
                      variante="fantasma"
                      tamano="s"
                      onClick={() => {
                        onChange("");
                        setAbierto(false);
                      }}
                    >
                      Limpiar
                    </Boton>
                  )}
                  <Boton
                    type="button"
                    variante="suave"
                    tamano="s"
                    disabled={hoyDeshabilitado}
                    onClick={() => {
                      onChange(hoy);
                      setAbierto(false);
                    }}
                  >
                    Hoy
                  </Boton>
                </div>
                <Boton type="button" variante="secundario" tamano="s" onClick={() => setAbierto(false)}>
                  Cerrar
                </Boton>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
