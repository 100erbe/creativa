"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

type Comando = {
  id: string;
  grupo: "Acciones rápidas" | "Riesgo y pipeline" | "Navegación";
  etiqueta: string;
  descripcion: string;
  href: string;
  icono: Parameters<typeof Icono>[0]["nombre"];
  badge?: string;
  badgeTono?: "critico" | "marca";
  palabrasClave?: string;
};

const COMANDOS: Comando[] = [
  {
    id: "nuevo-documento",
    grupo: "Acciones rápidas",
    etiqueta: "Nuevo documento",
    descripcion: "Crear presupuesto, albarán o factura",
    href: "/admin/documentos/nuevo",
    icono: "mas",
    palabrasClave: "presupuesto factura albaran crear emitir",
  },
  {
    id: "nuevo-cliente",
    grupo: "Acciones rápidas",
    etiqueta: "Nuevo cliente",
    descripcion: "Dar de alta una empresa o contacto",
    href: "/admin/clientes/nuevo",
    icono: "clientes",
    palabrasClave: "alta empresa nif cif",
  },
  {
    id: "nueva-campana",
    grupo: "Acciones rápidas",
    etiqueta: "Nueva campaña",
    descripcion: "Planificar soportes y puntos en mapa",
    href: "/admin/campanas/nueva",
    icono: "campanas",
    palabrasClave: "valla lona totem street marketing",
  },
  {
    id: "nuevo-gasto",
    grupo: "Acciones rápidas",
    etiqueta: "Nuevo gasto",
    descripcion: "Registrar factura de proveedor o gasto menor",
    href: "/admin/gastos/nuevo",
    icono: "gastos",
    palabrasClave: "ticket gasto deducible menor",
  },
  {
    id: "nuevo-producto",
    grupo: "Acciones rápidas",
    etiqueta: "Nuevo producto o servicio",
    descripcion: "Añadir artículo, servicio o formato al catálogo",
    href: "/admin/catalogo?nuevo=1",
    icono: "catalogo",
    palabrasClave: "crear producto servicio articulo formato tarifa precio",
  },
  {
    id: "vencidas-90",
    grupo: "Riesgo y pipeline",
    etiqueta: "Facturas insolutas 90+ días",
    descripcion: "Ver cobros en riesgo crítico con más de 90 días vencidos",
    href: "/admin/documentos?cobro=vencida_90",
    icono: "alerta",
    badge: "90+ días",
    badgeTono: "critico",
    palabrasClave: "impagadas morosos deuda vencidas critico cobro",
  },
  {
    id: "por-cobrar",
    grupo: "Riesgo y pipeline",
    etiqueta: "Facturas por cobrar",
    descripcion: "Pendientes, parciales y vencidas",
    href: "/admin/documentos?cobro=pendiente",
    icono: "documentos",
    palabrasClave: "pendiente cobro impagadas",
  },
  {
    id: "clientes-deuda",
    grupo: "Riesgo y pipeline",
    etiqueta: "Clientes con saldo pendiente",
    descripcion: "Listado filtrado por clientes con deuda abierta",
    href: "/admin/clientes?con_deuda=1",
    icono: "clientes",
    palabrasClave: "deuda saldo pendiente impagos morosos",
  },
  {
    id: "pipeline-campanas",
    grupo: "Riesgo y pipeline",
    etiqueta: "Pipeline de campañas",
    descripcion: "Vista Kanban por fase e incidencias",
    href: "/admin/campanas?vista=pipeline",
    icono: "kanban",
    badge: "Pipeline",
    badgeTono: "marca",
    palabrasClave: "kanban tablero columnas campañas incidencias",
  },
  {
    id: "pipeline-documentos",
    grupo: "Riesgo y pipeline",
    etiqueta: "Pipeline de documentos",
    descripcion: "Vista Kanban de presupuestos, facturas y cobros",
    href: "/admin/documentos?vista=pipeline",
    icono: "kanban",
    badge: "Pipeline",
    badgeTono: "marca",
    palabrasClave: "kanban tablero presupuestos ciclo comercial",
  },
  {
    id: "nav-panel",
    grupo: "Navegación",
    etiqueta: "Panel principal",
    descripcion: "KPIs, aging de cobros y actividad reciente",
    href: "/admin/panel",
    icono: "panel",
    palabrasClave: "inicio dashboard resumen",
  },
  {
    id: "nav-clientes",
    grupo: "Navegación",
    etiqueta: "Clientes",
    descripcion: "Directorio de clientes y facturación",
    href: "/admin/clientes",
    icono: "clientes",
  },
  {
    id: "nav-documentos",
    grupo: "Navegación",
    etiqueta: "Documentos",
    descripcion: "Presupuestos, albaranes y facturas",
    href: "/admin/documentos",
    icono: "documentos",
  },
  {
    id: "nav-campanas",
    grupo: "Navegación",
    etiqueta: "Campañas",
    descripcion: "Instalaciones, puntos y fotos",
    href: "/admin/campanas",
    icono: "campanas",
  },
  {
    id: "nav-catalogo",
    grupo: "Navegación",
    etiqueta: "Catálogo",
    descripcion: "Productos, servicios, formatos y precios",
    href: "/admin/catalogo",
    icono: "catalogo",
    palabrasClave: "productos servicios tarifas formatos precios",
  },
  {
    id: "nav-gastos",
    grupo: "Navegación",
    etiqueta: "Gastos",
    descripcion: "Aprobación y control de gastos",
    href: "/admin/gastos",
    icono: "gastos",
  },
  {
    id: "nav-contabilidad",
    grupo: "Navegación",
    etiqueta: "Contabilidad",
    descripcion: "Libro registro e IVA trimestral (303)",
    href: "/admin/contabilidad",
    icono: "contabilidad",
    palabrasClave: "iva 303 impuestos libro",
  },
  {
    id: "nav-avisos",
    grupo: "Navegación",
    etiqueta: "Avisos al equipo",
    descripcion: "Comunicaciones y confirmaciones",
    href: "/admin/avisos",
    icono: "avisos",
  },
  {
    id: "nav-ajustes",
    grupo: "Navegación",
    etiqueta: "Ajustes",
    descripcion: "Empresa, catálogo, pagos y equipo",
    href: "/admin/ajustes",
    icono: "ajustes",
  },
];

const EVENTO_ABRIR_PALETA = "abrir-paleta-comandos";

export function abrirPaletaComandos() {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_PALETA));
}

export function PaletaComandos() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [indiceActivo, setIndiceActivo] = useState(0);
  const entradaRef = useRef<HTMLInputElement>(null);
  const focoPrevioRef = useRef<HTMLElement | null>(null);

  const filtrados = useMemo(() => {
    const q = consulta.trim().toLowerCase();
    if (!q) return COMANDOS;
    return COMANDOS.filter((c) =>
      `${c.etiqueta} ${c.descripcion} ${c.grupo} ${c.palabrasClave ?? ""}`.toLowerCase().includes(q),
    );
  }, [consulta]);

  const grupos = useMemo(() => {
    const orden: Comando["grupo"][] = ["Acciones rápidas", "Riesgo y pipeline", "Navegación"];
    return orden
      .map((nombre) => ({
        nombre,
        items: filtrados.filter((c) => c.grupo === nombre),
      }))
      .filter((g) => g.items.length > 0);
  }, [filtrados]);

  function cerrar() {
    setAbierto(false);
    setConsulta("");
    setIndiceActivo(0);
    const previo = focoPrevioRef.current;
    focoPrevioRef.current = null;
    if (previo && typeof previo.focus === "function") {
      requestAnimationFrame(() => previo.focus());
    }
  }

  function ejecutar(comando: Comando) {
    cerrar();
    router.push(comando.href);
  }

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((prev) => {
          if (!prev) {
            focoPrevioRef.current = document.activeElement as HTMLElement | null;
            return true;
          }
          return false;
        });
      }
    };
    const alAbrirEvento = () => {
      focoPrevioRef.current = document.activeElement as HTMLElement | null;
      setAbierto(true);
    };
    window.addEventListener("keydown", alTeclear);
    window.addEventListener(EVENTO_ABRIR_PALETA, alAbrirEvento);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      window.removeEventListener(EVENTO_ABRIR_PALETA, alAbrirEvento);
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    setIndiceActivo(0);
    const t = requestAnimationFrame(() => entradaRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [abierto]);

  useEffect(() => {
    setIndiceActivo(0);
  }, [consulta]);

  if (!abierto) return null;

  const itemActivo = filtrados[indiceActivo];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center p-esp3 pt-[10vh] sm:p-esp6 sm:pt-[14vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Navegación rápida y comandos"
    >
      <button
        type="button"
        aria-label="Cerrar búsqueda rápida"
        tabIndex={-1}
        onClick={cerrar}
        className="animate-velo-entrar absolute inset-0 cursor-default bg-fondo-velo backdrop-blur-[1px]"
      />
      <div className="animate-modal-entrar relative flex max-h-[75dvh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-borde-default bg-fondo-elevado shadow-elevado">
        <div className="flex items-center gap-esp2 border-b border-borde-default px-esp4 py-esp3">
          <Icono nombre="buscar" size={18} className="text-icono-secundario" />
          <input
            ref={entradaRef}
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cerrar();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (filtrados.length > 0) setIndiceActivo((i) => (i + 1) % filtrados.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (filtrados.length > 0) setIndiceActivo((i) => (i - 1 + filtrados.length) % filtrados.length);
              } else if (e.key === "Enter" && itemActivo) {
                e.preventDefault();
                ejecutar(itemActivo);
              }
            }}
            placeholder="Ir a clientes, facturas 90+, pipeline o crear…"
            aria-label="Buscar comando o vista"
            aria-controls="paleta-resultados"
            aria-activedescendant={itemActivo ? `cmd-${itemActivo.id}` : undefined}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm text-texto-primario outline-none placeholder:text-texto-terciario"
          />
          <button
            type="button"
            onClick={cerrar}
            className="rounded border border-borde-default bg-fondo-sutil px-2 py-0.5 text-micro font-medium text-texto-terciario transition-colors duration-rapida ease-suave hover:text-texto-primario active:scale-press"
          >
            ESC
          </button>
        </div>

        <div id="paleta-resultados" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-esp2">
          {grupos.length === 0 ? (
            <p className="px-esp3 py-esp6 text-center text-sm text-texto-terciario">
              No hay resultados para «{consulta}».
            </p>
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.nombre} className="mb-esp2 last:mb-0">
                <p className="px-esp3 py-1.5 text-micro font-semibold uppercase tracking-wider text-texto-terciario">
                  {grupo.nombre}
                </p>
                <div className="flex flex-col gap-0.5">
                  {grupo.items.map((item) => {
                    const idxGlobal = filtrados.findIndex((f) => f.id === item.id);
                    const seleccionado = idxGlobal === indiceActivo;
                    return (
                      <button
                        key={item.id}
                        id={`cmd-${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={seleccionado}
                        onMouseEnter={() => setIndiceActivo(idxGlobal)}
                        onClick={() => ejecutar(item)}
                        className={cn(
                          "group flex min-h-11 w-full items-center gap-esp3 rounded-lg px-esp3 py-esp2 text-left transition-colors duration-rapida ease-suave",
                          seleccionado ? "bg-fondo-marca-sutil/80 text-texto-primario" : "hover:bg-fondo-sutil",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                            item.badgeTono === "critico"
                              ? "border-borde-critico-sutil bg-fondo-critico-sutil text-texto-critico"
                              : seleccionado
                                ? "border-borde-marca bg-fondo-superficie text-texto-marca"
                                : "border-borde-default bg-fondo-sutil text-icono-default",
                          )}
                        >
                          <Icono nombre={item.icono} size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-texto-primario">{item.etiqueta}</p>
                          <p className="truncate text-xs text-texto-terciario">{item.descripcion}</p>
                        </div>
                        {item.badge && (
                          <span
                            className={cn(
                              "shrink-0 rounded-completo border px-2 py-0.5 text-micro font-semibold",
                              item.badgeTono === "critico"
                                ? "border-borde-critico-sutil bg-fondo-critico-sutil text-texto-critico"
                                : "border-borde-marca bg-fondo-marca-sutil text-texto-marca",
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                        <Icono
                          nombre="flechaDerecha"
                          size={14}
                          className="shrink-0 text-icono-secundario transition-transform duration-rapida ease-salida group-hover:translate-x-0.5"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden items-center justify-between border-t border-borde-default bg-fondo-sutil/60 px-esp4 py-esp2 text-micro text-texto-terciario sm:flex">
          <span>↑↓ para navegar · Enter para abrir</span>
          <span>⌘K / Ctrl+K para alternar</span>
        </div>
      </div>
    </div>
  );
}
