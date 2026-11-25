"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

/** Un resultado sugerido mientras se escribe. */
import type { Sugerencia } from "@/lib/tipos-ui";
export type { Sugerencia };

type Props = {
  /** Devuelve las sugerencias para el texto dado; se muestran como mucho `limite`. */
  buscar: (texto: string) => Promise<Sugerencia[]> | Sugerencia[];
  /** Qué hacer al elegir una sugerencia. Por defecto navega a su `href`. */
  onElegir?: (s: Sugerencia) => void;
  /** Modo controlado (filtros en cliente). */
  value?: string;
  onChange?: (texto: string) => void;
  /** Modo no controlado (formularios GET con `name="q"`). */
  defaultValue?: string;
  name?: string;
  placeholder?: string;
  ariaLabel: string;
  /** Clases del `<input>`; se le añade el hueco del icono de búsqueda. */
  className?: string;
  /** Clases del contenedor (anchura, flex…). */
  classNameContenedor?: string;
  limite?: number;
  minCaracteres?: number;
  retardoMs?: number;
  /** Texto de ayuda al pie de la lista; `null` lo oculta. */
  pie?: string | null;
};

const PIE_POR_DEFECTO = "Intro para ver todos los resultados";

/** Resalta (en negrita) la primera aparición del texto buscado, sin distinguir mayúsculas ni tildes. */
function Resaltado({ texto, buscado }: { texto: string; buscado: string }) {
  const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = normalizar(buscado.trim());
  // Solo si la normalización no cambia la longitud, para que los índices coincidan.
  const base = normalizar(texto);
  const i = q && base.length === texto.length ? base.indexOf(q) : -1;
  if (i < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <mark className="bg-transparent font-bold text-texto-primario">{texto.slice(i, i + q.length)}</mark>
      {texto.slice(i + q.length)}
    </>
  );
}

/**
 * Campo de búsqueda con sugerencias (combobox ARIA): muestra los primeros resultados
 * mientras se escribe y permite abrirlos directamente con el ratón o el teclado
 * (↑/↓ para moverse, Intro para abrir, Esc para cerrar).
 * Si no hay ninguna sugerencia seleccionada, Intro mantiene el comportamiento normal
 * del campo (enviar el formulario o filtrar la lista completa).
 */
export function Autocompletar({
  buscar,
  onElegir,
  value,
  onChange,
  defaultValue,
  name,
  placeholder,
  ariaLabel,
  className,
  classNameContenedor,
  limite = 3,
  minCaracteres = 2,
  retardoMs = 250,
  pie = PIE_POR_DEFECTO,
}: Props) {
  const router = useRouter();
  const idLista = useId();
  const controlado = value !== undefined;
  const [interno, setInterno] = useState(defaultValue ?? "");
  const texto = controlado ? value : interno;

  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [resultados, setResultados] = useState<Sugerencia[]>([]);
  const [activo, setActivo] = useState(-1);
  /** Texto para el que se obtuvieron `resultados` (evita mostrar «sin resultados» de una búsqueda anterior). */
  const [consultado, setConsultado] = useState("");
  const peticion = useRef(0);
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;

  const limpio = texto.trim();
  const suficiente = limpio.length >= minCaracteres;

  useEffect(() => {
    const id = ++peticion.current;
    if (!suficiente) {
      setResultados([]);
      setConsultado("");
      setCargando(false);
      return;
    }
    setCargando(true);
    const t = setTimeout(async () => {
      try {
        const lista = await buscarRef.current(limpio);
        if (peticion.current !== id) return;
        setResultados(lista.slice(0, limite));
      } catch {
        if (peticion.current !== id) return;
        setResultados([]);
      }
      setConsultado(limpio);
      setActivo(-1);
      setCargando(false);
    }, retardoMs);
    return () => clearTimeout(t);
  }, [limpio, suficiente, limite, retardoMs]);

  function cambiar(v: string) {
    if (!controlado) setInterno(v);
    onChange?.(v);
    setAbierto(true);
  }

  function elegir(s: Sugerencia) {
    setAbierto(false);
    setActivo(-1);
    if (onElegir) onElegir(s);
    else if (s.href) router.push(s.href);
  }

  const visible = abierto && suficiente;
  const vacio = visible && !cargando && consultado === limpio && resultados.length === 0;
  const idOpcion = (i: number) => `${idLista}-op-${i}`;

  return (
    <div className={cn("relative min-w-0", classNameContenedor)}>
      <Icono
        nombre="buscar"
        size={16}
        className="pointer-events-none absolute left-esp3 top-1/2 -translate-y-1/2 text-icono-secundario"
      />
      <input
        type="search"
        name={name}
        value={texto}
        onChange={(e) => cambiar(e.target.value)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (!suficiente) return;
            e.preventDefault();
            setAbierto(true);
            const n = resultados.length;
            if (n === 0) return;
            setActivo((a) => (e.key === "ArrowDown" ? (a + 1 >= n ? -1 : a + 1) : a - 1 < -1 ? n - 1 : a - 1));
          } else if (e.key === "Enter") {
            const s = visible ? resultados[activo] : undefined;
            if (s) {
              e.preventDefault();
              elegir(s);
            } else {
              // Sin selección: Intro sigue enviando el formulario / filtrando la lista.
              setAbierto(false);
            }
          } else if (e.key === "Escape") {
            if (visible) {
              e.preventDefault();
              e.stopPropagation();
              setAbierto(false);
              setActivo(-1);
            }
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={idLista}
        aria-activedescendant={visible && activo >= 0 ? idOpcion(activo) : undefined}
        autoComplete="off"
        enterKeyHint="search"
        className={cn("pl-9", className)}
      />

      {visible && (
        <div className="animate-estado-entrar absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-borde-default bg-fondo-superficie shadow-elevado">
          <ul id={idLista} role="listbox" aria-label={`Sugerencias: ${ariaLabel}`} className="flex flex-col p-esp1">
            {resultados.map((s, i) => (
              <li
                key={s.id}
                id={idOpcion(i)}
                role="option"
                aria-selected={i === activo}
                // mousedown para que el campo no pierda el foco (y cierre la lista) antes del clic.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(s)}
                onMouseEnter={() => setActivo(i)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-esp3 rounded-md px-esp3 py-esp2 transition-colors duration-rapida ease-suave md:min-h-9",
                  i === activo ? "bg-fondo-marca-sutil" : "hover:bg-fondo-sutil",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-texto-primario">
                    <Resaltado texto={s.titulo} buscado={limpio} />
                  </span>
                  {s.detalle && <span className="truncate text-xs text-texto-secundario">{s.detalle}</span>}
                </span>
                {s.insignia && (
                  <span className="shrink-0 rounded-md bg-fondo-sutil px-esp2 py-0.5 text-micro font-semibold text-texto-secundario">
                    {s.insignia}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div aria-live="polite" className="text-xs text-texto-terciario">
            {cargando && resultados.length === 0 && <p className="px-esp4 py-esp3">Buscando…</p>}
            {vacio && <p className="px-esp4 py-esp3">Sin resultados para «{limpio}».</p>}
          </div>
          {pie && resultados.length > 0 && (
            <p className="border-t border-borde-default px-esp4 py-esp2 text-micro text-texto-terciario">{pie}</p>
          )}
        </div>
      )}
    </div>
  );
}
