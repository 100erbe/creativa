"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { ETIQUETA_TIPO } from "@/lib/documentos";
import { TIPOS_CLIENTE, TIPOS_DOCUMENTO_ID } from "@/lib/clientes";
import { crearClienteRapido } from "../../clientes/acciones";
import { cambiarCliente, cambiarTipo, crearBorrador, type TipoNuevoDocumento } from "./acciones";
import { desenvolver } from "@/lib/accion";

type Cliente = {
  id: number;
  razon_social: string;
  nombre_comercial: string | null;
  numero_documento: string | null;
};

const TIPOS: { valor: TipoNuevoDocumento; descripcion: string }[] = [
  { valor: "presupuesto", descripcion: "Oferta para que el cliente la acepte" },
  { valor: "albaran", descripcion: "Trabajo hecho, pendiente de facturar" },
  { valor: "factura", descripcion: "Documento fiscal con número correlativo" },
];

export function PasoCliente({
  clientes: clientesIniciales,
  documento,
  tipoInicial,
  clienteInicialId,
}: {
  clientes: Cliente[];
  /** Si viene, estamos cambiando el tipo o el cliente de un borrador ya creado. */
  documento?: { id: number; tipo: string; cliente_id: number; tipoFijo: boolean };
  tipoInicial?: TipoNuevoDocumento;
  /** Cliente ya elegido (se llega desde su ficha). */
  clienteInicialId?: number;
}) {
  const router = useRouter();
  const [clientes, setClientes] = useState(clientesIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoNuevoDocumento>(
    tipoInicial ?? (TIPOS.find((t) => t.valor === documento?.tipo)?.valor || "presupuesto"),
  );
  const tipoEditable = !documento?.tipoFijo;
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(
    clientesIniciales.find((c) => c.id === (documento?.cliente_id ?? clienteInicialId)) ?? null,
  );
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function cerrar() {
    setAbierto(false);
    setBusqueda("");
  }

  function elegir(c: Cliente) {
    setSeleccionado(c);
    cerrar();
  }

  const tipoMostrado = tipoEditable ? tipo : (documento?.tipo ?? tipo);
  const etiquetaTipo = ETIQUETA_TIPO[tipoMostrado] ?? "documento";
  const femenino = tipoMostrado === "factura" || tipoMostrado === "rectificativa";

  function continuar() {
    if (!seleccionado) return;
    setError(null);
    iniciar(async () => {
      try {
        if (documento) {
          if (tipoEditable && tipo !== documento.tipo) await desenvolver(cambiarTipo(documento.id, tipo));
          if (seleccionado.id !== documento.cliente_id) await desenvolver(cambiarCliente(documento.id, seleccionado.id));
          router.push(`/admin/documentos/nuevo?documento=${documento.id}`);
        } else {
          const id = await desenvolver(crearBorrador(seleccionado.id, tipo));
          // replace: el paso 1 sin documento no debe quedar en el historial, o el botón "atrás"
          // del navegador volvería a él y "Continuar" crearía otra borrador duplicado.
          router.replace(`/admin/documentos/nuevo?documento=${id}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo continuar.");
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-esp5">
      <div>
        <p className="text-xs text-texto-terciario">Documentos / Nuevo</p>
        <h1 className="text-2xl font-bold text-texto-primario md:text-titulo-pagina">
          {documento
            ? `Tipo y cliente ${femenino ? "de la" : "del"} ${etiquetaTipo.toLowerCase()}`
            : `${femenino ? "Nueva" : "Nuevo"} ${etiquetaTipo.toLowerCase()}`}
        </h1>
      </div>
      <PasosDocumento actual={1} documentoId={documento?.id} />

      {documento && !tipoEditable && (
        <p className="text-xs text-texto-terciario">
          Este documento viene de otro (conversión o versión), así que conserva su tipo.
        </p>
      )}

      {tipoEditable && (
        <div className="flex flex-col gap-esp2">
          <span id="tipo-documento" className="text-xs font-medium text-texto-secundario">
            Tipo de documento
          </span>
          {/* Tres opciones visibles, de un toque: sin desplegable. */}
          <div role="radiogroup" aria-labelledby="tipo-documento" className="grid grid-cols-3 gap-esp2">
            {TIPOS.map((t) => {
              const activo = tipo === t.valor;
              return (
                <button
                  key={t.valor}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => setTipo(t.valor)}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md border px-esp2 py-esp2 text-center transition-colors md:items-start md:text-left",
                    activo
                      ? "border-borde-foco bg-fondo-marca-sutil ring-2 ring-borde-foco/20"
                      : "border-borde-campo bg-fondo-superficie hover:bg-fondo-sutil",
                  )}
                >
                  <span className={cn("text-sm font-semibold", activo ? "text-texto-marca" : "text-texto-primario")}>
                    {ETIQUETA_TIPO[t.valor]}
                  </span>
                  <span className="hidden text-xs text-texto-terciario md:block">{t.descripcion}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-texto-terciario md:hidden">
            {TIPOS.find((t) => t.valor === tipo)?.descripcion}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-esp2">
        <span className="text-xs font-medium text-texto-secundario">Cliente</span>
        <div className="flex items-start gap-esp3">
          <div className="relative min-w-0 flex-1">
            <button
                type="button"
                onClick={() => setAbierto(true)}
                aria-haspopup="listbox"
                aria-expanded={abierto}
                className={cn(
                  "flex min-h-12 w-full items-center gap-esp3 rounded-md border px-esp3 py-esp2 text-left md:min-h-10",
                  seleccionado
                    ? "border-borde-foco bg-fondo-marca-sutil"
                    : "border-borde-campo bg-fondo-superficie hover:bg-fondo-sutil",
                )}
              >
                {seleccionado ? (
                  <>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fondo-marca text-texto-sobre-marca">
                      <Icono nombre="check" size={14} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-texto-primario">
                        {seleccionado.nombre_comercial || seleccionado.razon_social}
                      </span>
                      <span className="truncate text-xs text-texto-secundario">
                        {seleccionado.razon_social}
                        {seleccionado.numero_documento ? ` · ${seleccionado.numero_documento}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-texto-marca">Cambiar</span>
                  </>
                ) : (
                  <>
                    <Icono nombre="buscar" size={16} className="shrink-0 text-texto-terciario" />
                    <span className="text-sm text-texto-terciario">Seleccionar cliente…</span>
                  </>
                )}
              </button>

            {abierto && (
              <SelectorCliente
                clientes={clientes}
                busqueda={busqueda}
                onBusqueda={setBusqueda}
                seleccionadoId={seleccionado?.id}
                onElegir={elegir}
                onCerrar={cerrar}
                onCrear={() => {
                  setAbierto(false);
                  setCreando(true);
                }}
              />
            )}
          </div>
          <Boton
            variante="secundario"
            onClick={() => {
              setAbierto(false);
              setCreando((v) => !v);
            }}
          >
            <Icono nombre={creando ? "cerrar" : "mas"} size={16} />
            <span className="hidden sm:inline">{creando ? "Cerrar" : "Nuevo cliente"}</span>
          </Boton>
        </div>
      </div>

      {creando && (
        <FormularioClienteRapido
          razonInicial={busqueda}
          onCreado={(c) => {
            setClientes((prev) => [c, ...prev]);
            setSeleccionado(c);
            setBusqueda("");
            setCreando(false);
          }}
        />
      )}

      {error && <p className="text-sm text-texto-peligro">{error}</p>}

      <div className="flex items-center gap-esp3">
        <Boton
          disabled={!seleccionado || pendiente}
          cargando={pendiente}
          onClick={continuar}
          className="ml-auto w-full md:w-auto"
        >
          Continuar
        </Boton>
      </div>
    </div>
  );
}

/**
 * Buscador de clientes.
 * - Escritorio: desplegable bajo el botón, con el foco en la búsqueda.
 * - Móvil: panel a pantalla completa, búsqueda arriba y lista debajo. Su altura
 *   sigue al `visualViewport`: cuando sale el teclado la lista se encoge y se
 *   puede desplazar entera por encima de él. El teclado no se abre solo
 *   (primero se ve la lista) y se esconde al desplazar la lista.
 */
function SelectorCliente({
  clientes,
  busqueda,
  onBusqueda,
  seleccionadoId,
  onElegir,
  onCerrar,
  onCrear,
}: {
  clientes: Cliente[];
  busqueda: string;
  onBusqueda: (v: string) => void;
  seleccionadoId?: number;
  onElegir: (c: Cliente) => void;
  onCerrar: () => void;
  onCrear: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const entradaBusqueda = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<{ alto: number; arriba: number } | null>(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  const filtrados = clientes.filter((c) =>
    `${c.razon_social} ${c.nombre_comercial ?? ""} ${c.numero_documento ?? ""}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );

  useEffect(() => {
    const movil = window.matchMedia("(max-width: 767px)").matches;

    // Escritorio: foco directo en la búsqueda y cierre al hacer clic fuera.
    if (!movil) {
      entradaBusqueda.current?.focus();
      const fuera = (e: PointerEvent) => {
        if (!panel.current?.contains(e.target as Node)) cerrarRef.current();
      };
      document.addEventListener("pointerdown", fuera);
      return () => document.removeEventListener("pointerdown", fuera);
    }

    // Móvil: bloquea el scroll de la página y ajusta el panel al área visible.
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const vv = window.visualViewport;
    const ajustar = () => {
      if (vv) setVista({ alto: vv.height, arriba: vv.offsetTop });
    };
    ajustar();
    vv?.addEventListener("resize", ajustar);
    vv?.addEventListener("scroll", ajustar);
    return () => {
      document.body.style.overflow = anterior;
      vv?.removeEventListener("resize", ajustar);
      vv?.removeEventListener("scroll", ajustar);
    };
  }, []);

  return (
    <div
      ref={panel}
      style={
        vista
          ? ({ "--vv-alto": `${vista.alto}px`, "--vv-arriba": `${vista.arriba}px` } as React.CSSProperties)
          : undefined
      }
      className={cn(
        // Móvil: pantalla completa, alto = parte visible sobre el teclado.
        "fixed inset-x-0 top-[var(--vv-arriba,0px)] z-50 flex h-[var(--vv-alto,100dvh)] flex-col bg-fondo-superficie",
        // Escritorio: desplegable.
        "md:absolute md:inset-x-0 md:top-full md:z-20 md:mt-1 md:h-auto md:max-h-80 md:rounded-lg md:border md:border-borde-default md:shadow-lg",
      )}
    >
      <div className="flex items-center gap-esp2 border-b border-borde-default p-esp3 md:p-esp2">
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-texto-secundario hover:bg-fondo-sutil md:hidden"
        >
          <Icono nombre="atras" size={20} />
        </button>
        <div className="relative min-w-0 flex-1">
          <Icono
            nombre="buscar"
            size={16}
            className="pointer-events-none absolute left-esp3 top-1/2 -translate-y-1/2 text-texto-terciario"
          />
          <input
            ref={entradaBusqueda}
            type="search"
            enterKeyHint="search"
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCerrar();
              if (e.key === "Enter") {
                e.preventDefault();
                // Con un único resultado lo elige; si no, solo esconde el teclado.
                const unico = filtrados.length === 1 ? filtrados[0] : undefined;
                if (unico) onElegir(unico);
                else entradaBusqueda.current?.blur();
              }
            }}
            placeholder="Buscar por nombre o NIF/CIF…"
            role="combobox"
            aria-expanded="true"
            aria-controls="lista-clientes"
            aria-label="Buscar cliente"
            className="h-11 w-full rounded-lg border border-borde-campo bg-fondo-superficie pl-9 pr-esp3 text-base text-texto-primario outline-none placeholder:text-texto-terciario focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20 md:h-9 md:text-sm"
          />
        </div>
      </div>

      <div
        id="lista-clientes"
        role="listbox"
        onTouchMove={() => {
          if (document.activeElement === entradaBusqueda.current) entradaBusqueda.current?.blur();
        }}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-esp2"
      >
        {filtrados.map((c) => (
          <button
            key={c.id}
            type="button"
            role="option"
            aria-selected={seleccionadoId === c.id}
            onClick={() => onElegir(c)}
            className={cn(
              "flex min-h-12 shrink-0 items-center gap-esp3 rounded-md px-esp3 py-esp2 text-left md:min-h-11",
              seleccionadoId === c.id ? "bg-fondo-marca-sutil" : "hover:bg-fondo-sutil active:bg-fondo-sutil",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-texto-primario">
                {c.nombre_comercial || c.razon_social}
              </span>
              <span className="truncate text-xs text-texto-terciario">
                {c.razon_social} {c.numero_documento ? `· ${c.numero_documento}` : ""}
              </span>
            </span>
            {seleccionadoId === c.id && <Icono nombre="check" size={16} className="text-icono-marca" />}
          </button>
        ))}
        {filtrados.length === 0 && <p className="px-esp3 py-esp3 text-sm text-texto-terciario">Sin resultados.</p>}
        <button
          type="button"
          onClick={onCrear}
          className="flex min-h-12 shrink-0 items-center gap-esp3 rounded-md px-esp3 py-esp2 text-left text-sm font-medium text-texto-marca hover:bg-fondo-sutil md:min-h-11"
        >
          <Icono nombre="mas" size={16} />
          {busqueda.trim() ? `Crear «${busqueda.trim()}» como cliente nuevo` : "Crear cliente nuevo"}
        </button>
      </div>
    </div>
  );
}

const entrada =
  "h-9 w-full rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco";

function FormularioClienteRapido({
  razonInicial,
  onCreado,
}: {
  razonInicial: string;
  onCreado: (c: Cliente) => void;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const campos = Object.fromEntries(
          [...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]),
        ) as Parameters<typeof crearClienteRapido>[0];
        setError(null);
        iniciar(async () => {
          const r = await crearClienteRapido(campos);
          if ("error" in r) setError(r.error);
          else onCreado(r.cliente);
        });
      }}
    >
      <div>
        <h2 className="text-titulo-panel text-texto-primario">Nuevo cliente</h2>
        <p className="text-xs text-texto-terciario">
          Lo básico para el documento. El resto (forma de pago, contactos…) se completa luego en su ficha.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-esp3 md:grid-cols-2">
        <Etiqueta texto="Razón social *" className="md:col-span-2">
          <input name="razon_social" required minLength={2} defaultValue={razonInicial} autoFocus className={entrada} />
        </Etiqueta>
        <Etiqueta texto="Nombre comercial">
          <input name="nombre_comercial" className={entrada} />
        </Etiqueta>
        <Etiqueta texto="Tipo de cliente">
          <select name="tipo_cliente" defaultValue="marca_empresa" className={entrada}>
            {TIPOS_CLIENTE.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </Etiqueta>
        <Etiqueta texto="Tipo de persona">
          <select name="tipo_persona" defaultValue="juridica" className={entrada}>
            <option value="juridica">Jurídica (empresa)</option>
            <option value="fisica">Física (autónomo / particular)</option>
          </select>
        </Etiqueta>
        <div className="grid grid-cols-[100px_1fr] gap-esp2">
          <Etiqueta texto="Documento">
            <select name="tipo_documento" defaultValue="CIF" className={entrada}>
              {TIPOS_DOCUMENTO_ID.map((t) => (
                <option key={t} value={t}>
                  {t === "VAT_UE" ? "VAT" : t}
                </option>
              ))}
            </select>
          </Etiqueta>
          <Etiqueta texto="Número">
            <input name="numero_documento" placeholder="B12345678" className={entrada} />
          </Etiqueta>
        </div>
        <Etiqueta texto="Dirección" className="md:col-span-2">
          <input name="direccion" className={entrada} />
        </Etiqueta>
        <div className="grid grid-cols-[100px_1fr] gap-esp2">
          <Etiqueta texto="C.P.">
            <input name="codigo_postal" className={entrada} />
          </Etiqueta>
          <Etiqueta texto="Municipio">
            <input name="municipio" className={entrada} />
          </Etiqueta>
        </div>
        <Etiqueta texto="Provincia">
          <input name="provincia" className={entrada} />
        </Etiqueta>
        <Etiqueta texto="Email de facturación">
          <input name="email_facturacion" type="email" className={entrada} />
        </Etiqueta>
        <Etiqueta texto="Teléfono">
          <input name="telefono" className={entrada} />
        </Etiqueta>
      </div>
      {error && <p className="text-sm text-texto-peligro">{error}</p>}
      <Boton type="submit" cargando={pendiente} className="self-end">
        Crear y seleccionar
      </Boton>
    </form>
  );
}

function Etiqueta({
  texto,
  className,
  children,
}: {
  texto: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-texto-secundario">{texto}</span>
      {children}
    </label>
  );
}
