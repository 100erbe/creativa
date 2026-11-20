"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { createClient } from "@/lib/supabase/client";
import { ETIQUETA_ESTADO_DOC, ETIQUETA_TIPO } from "@/lib/documentos";
import { ETIQUETA_ESTADO_CAMPANA } from "@/lib/etiquetas";
import { euros, fechaCorta } from "@/lib/formato";
import { cn } from "@/lib/cn";

type GrupoResultado =
  | "Documentos"
  | "Archivos sin asignar"
  | "Clientes"
  | "Campañas"
  | "Gastos"
  | "Acciones rápidas"
  | "Riesgo y tablero"
  | "Navegación";

type ElementoPaleta = {
  id: string;
  grupo: GrupoResultado;
  etiqueta: string;
  descripcion: string;
  href: string;
  icono: Parameters<typeof Icono>[0]["nombre"];
  badge?: string;
  badgeTono?: "critico" | "marca";
  palabrasClave?: string;
  externo?: boolean;
};

type Comando = ElementoPaleta & {
  grupo: "Acciones rápidas" | "Riesgo y tablero" | "Navegación";
};

const PREFIJOS_TIPO: Record<string, "factura" | "presupuesto" | "albaran" | "rectificativa"> = {
  factura: "factura",
  facturas: "factura",
  presupuesto: "presupuesto",
  presupuestos: "presupuesto",
  albaran: "albaran",
  albarán: "albaran",
  albaranes: "albaran",
  rectificativa: "rectificativa",
  rectificativas: "rectificativa",
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
    grupo: "Riesgo y tablero",
    etiqueta: "Facturas vencidas 90+ días",
    descripcion: "Ver cobros en riesgo crítico con más de 90 días vencidos",
    href: "/admin/documentos?cobro=vencida_90",
    icono: "alerta",
    badge: "90+ días",
    badgeTono: "critico",
    palabrasClave: "impagadas morosos deuda vencidas critico cobro",
  },
  {
    id: "por-cobrar",
    grupo: "Riesgo y tablero",
    etiqueta: "Facturas por cobrar",
    descripcion: "Pendientes, parciales y vencidas",
    href: "/admin/documentos?cobro=pendiente",
    icono: "documentos",
    palabrasClave: "pendiente cobro impagadas",
  },
  {
    id: "clientes-deuda",
    grupo: "Riesgo y tablero",
    etiqueta: "Clientes con saldo pendiente",
    descripcion: "Listado filtrado por clientes con deuda abierta",
    href: "/admin/clientes?con_deuda=1",
    icono: "clientes",
    palabrasClave: "deuda saldo pendiente impagos morosos",
  },
  {
    id: "tablero-campanas",
    grupo: "Riesgo y tablero",
    etiqueta: "Tablero de campañas",
    descripcion: "Vista Kanban por fase e incidencias",
    href: "/admin/campanas?vista=tablero",
    icono: "kanban",
    badge: "Tablero",
    badgeTono: "marca",
    palabrasClave: "kanban tablero columnas campañas incidencias",
  },
  {
    id: "tablero-documentos",
    grupo: "Riesgo y tablero",
    etiqueta: "Tablero de documentos",
    descripcion: "Vista Kanban de presupuestos, facturas y cobros",
    href: "/admin/documentos?vista=tablero",
    icono: "kanban",
    badge: "Tablero",
    badgeTono: "marca",
    palabrasClave: "kanban tablero presupuestos ciclo comercial",
  },
  {
    id: "nav-panel",
    grupo: "Navegación",
    etiqueta: "Resumen",
    descripcion: "KPIs, cobros y vencimientos, tareas y actividad reciente",
    href: "/admin/panel",
    icono: "panel",
    palabrasClave: "inicio dashboard panel principal",
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
    id: "nav-cobros",
    grupo: "Navegación",
    etiqueta: "Cobros",
    descripcion: "Saldo pendiente, antigüedad, vencidas y cobros registrados",
    href: "/admin/cobros",
    icono: "cobros",
    palabrasClave: "cobro pendiente vencida aging antiguedad impagadas reclamar",
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
  {
    id: "nav-cuenta",
    grupo: "Navegación",
    etiqueta: "Mi cuenta",
    descripcion: "Nombre, teléfono, email de acceso y contraseña",
    href: "/admin/cuenta",
    icono: "clientes",
    palabrasClave: "perfil usuario datos personales telefono nombre",
  },
  {
    id: "nav-ayuda",
    grupo: "Navegación",
    etiqueta: "Ayuda",
    descripcion: "Guías rápidas, atajos de teclado y contacto",
    href: "/admin/ayuda",
    icono: "ayuda",
    palabrasClave: "guia manual soporte atajos teclado como",
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
  const [resultadosBd, setResultadosBd] = useState<ElementoPaleta[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const entradaRef = useRef<HTMLInputElement>(null);
  const focoPrevioRef = useRef<HTMLElement | null>(null);
  const peticionRef = useRef(0);

  const consultaLimpia = useMemo(() => consulta.replace(/[,()%*\\]/g, " ").trim(), [consulta]);

  useEffect(() => {
    if (!abierto || !consultaLimpia) {
      peticionRef.current += 1;
      setResultadosBd([]);
      setBuscando(false);
      return;
    }

    const idPeticion = ++peticionRef.current;
    setBuscando(true);

    const temporizador = setTimeout(async () => {
      try {
        const supabase = createClient();
        const q = consultaLimpia;
        const palabras = q.toLowerCase().split(/\s+/).filter(Boolean);
        const tipoPrefijo = palabras.length > 0 ? PREFIJOS_TIPO[palabras[0]!] : undefined;
        const qDoc = tipoPrefijo ? q.slice(palabras[0]!.length).trim() : q;

        // 1. Clientes (sirve para mostrar clientes y localizar documentos por cliente_id).
        const qClientesFiltro = qDoc || q;
        const resClientes = await supabase
          .from("clientes")
          .select("id, codigo, razon_social, nombre_comercial, numero_documento")
          .or(
            ["razon_social", "nombre_comercial", "numero_documento", "codigo"]
              .map((c) => `${c}.ilike.%${qClientesFiltro}%`)
              .join(","),
          )
          .order("razon_social")
          .limit(50);

        if (peticionRef.current !== idPeticion) return;
        const clientes = resClientes.data ?? [];
        const clienteIds = clientes.map((c) => c.id);

        // 2. Documentos (facturas, presupuestos, albaranes, rectificativas).
        let consultaDocs = supabase
          .from("documentos")
          .select(
            "id, tipo, estado, numero_completo, archivo_origen, descripcion, campana, total, fecha, cliente_razon_social, clientes(razon_social, nombre_comercial)",
          )
          .order("fecha", { ascending: false })
          .order("id", { ascending: false })
          .limit(10);

        if (tipoPrefijo) {
          consultaDocs = consultaDocs.eq("tipo", tipoPrefijo);
        }
        if (qDoc) {
          const condicionesDoc = [
            `numero_completo.ilike.%${qDoc}%`,
            `archivo_origen.ilike.%${qDoc}%`,
            `pdf_url.ilike.%${qDoc}%`,
            `descripcion.ilike.%${qDoc}%`,
            `campana.ilike.%${qDoc}%`,
            `cliente_razon_social.ilike.%${qDoc}%`,
          ];
          if (/^\d+$/.test(qDoc)) {
            condicionesDoc.push(`numero.eq.${Number(qDoc)}`);
          }
          if (clienteIds.length > 0) {
            condicionesDoc.push(`cliente_id.in.(${clienteIds.join(",")})`);
          }
          consultaDocs = consultaDocs.or(condicionesDoc.join(","));
        }

        const qPdfFiltro = qDoc || q;
        const condicionesPdf = [`archivo.ilike.%${qPdfFiltro}%`];
        if (/^\d+$/.test(qPdfFiltro)) {
          condicionesPdf.push(`numero.eq.${Number(qPdfFiltro)}`);
        }

        const [resDocs, resPdfs, resCampanas, resGastos] = await Promise.all([
          consultaDocs,
          supabase
            .from("pdfs_sin_asignar")
            .select("id, archivo, drive_file_id, tipo, numero, total")
            .or(condicionesPdf.join(","))
            .order("archivo")
            .limit(5),
          supabase
            .from("campanas")
            .select("id, codigo, nombre, estado, clientes(razon_social)")
            .or([`nombre.ilike.%${q}%`, `codigo.ilike.%${q}%`, `descripcion.ilike.%${q}%`].join(","))
            .order("fecha_inicio", { ascending: false })
            .limit(5),
          supabase
            .from("gastos")
            .select("id, codigo, concepto, proveedor, numero_factura, total, fecha")
            .or(
              ["concepto", "proveedor", "numero_factura", "codigo", "ticket_path"]
                .map((c) => `${c}.ilike.%${q}%`)
                .join(","),
            )
            .order("fecha", { ascending: false })
            .order("id", { ascending: false })
            .limit(5),
        ]);

        if (peticionRef.current !== idPeticion) return;

        const items: ElementoPaleta[] = [];

        for (const d of resDocs.data ?? []) {
          const cli = Array.isArray(d.clientes) ? d.clientes[0] : d.clientes;
          const nombreCliente = d.cliente_razon_social ?? cli?.razon_social ?? cli?.nombre_comercial ?? null;
          const tituloDoc = d.numero_completo ?? d.archivo_origen ?? "Borrador";
          const etiqueta = nombreCliente ? `${tituloDoc} · ${nombreCliente}` : tituloDoc;
          const partesDesc = [
            ETIQUETA_ESTADO_DOC[d.estado] ?? d.estado,
            d.fecha ? fechaCorta(d.fecha) : null,
            euros(Number(d.total)),
            d.archivo_origen && d.archivo_origen !== tituloDoc ? d.archivo_origen : null,
          ].filter(Boolean);
          items.push({
            id: `doc-${d.id}`,
            grupo: "Documentos",
            etiqueta,
            descripcion: partesDesc.join(" · "),
            href: `/admin/documentos/${d.id}`,
            icono: "documentos",
            badge: ETIQUETA_TIPO[d.tipo] ?? d.tipo,
            badgeTono: d.estado === "anulado" ? "critico" : "marca",
          });
        }

        for (const p of resPdfs.data ?? []) {
          const partesDesc = [
            "PDF sin asignar",
            p.tipo ? `${p.tipo}${p.numero != null ? ` n.º ${p.numero}` : ""}` : null,
            p.total != null ? euros(Number(p.total)) : null,
          ].filter(Boolean);
          items.push({
            id: `pdf-${p.id}`,
            grupo: "Archivos sin asignar",
            etiqueta: p.archivo,
            descripcion: partesDesc.join(" · "),
            href: p.drive_file_id
              ? `https://drive.google.com/file/d/${encodeURIComponent(p.drive_file_id)}/view`
              : "/admin/documentos?revision=sin_pdf",
            icono: "documentos",
            externo: Boolean(p.drive_file_id),
          });
        }

        for (const c of clientes.slice(0, 5)) {
          const nombreComercial =
            c.nombre_comercial && c.nombre_comercial !== c.razon_social ? c.nombre_comercial : null;
          items.push({
            id: `cli-${c.id}`,
            grupo: "Clientes",
            etiqueta: c.razon_social,
            descripcion: [nombreComercial, c.codigo, c.numero_documento].filter(Boolean).join(" · ") || "Cliente",
            href: `/admin/clientes/${c.id}`,
            icono: "clientes",
          });
        }

        for (const camp of resCampanas.data ?? []) {
          const cli = Array.isArray(camp.clientes) ? camp.clientes[0] : camp.clientes;
          items.push({
            id: `camp-${camp.id}`,
            grupo: "Campañas",
            etiqueta: camp.nombre,
            descripcion: [
              camp.codigo,
              cli?.razon_social,
              ETIQUETA_ESTADO_CAMPANA[camp.estado] ?? camp.estado,
            ]
              .filter(Boolean)
              .join(" · "),
            href: `/admin/campanas/${camp.id}`,
            icono: "campanas",
          });
        }

        for (const g of resGastos.data ?? []) {
          items.push({
            id: `gasto-${g.id}`,
            grupo: "Gastos",
            etiqueta: g.concepto,
            descripcion: [
              g.numero_factura || g.codigo,
              g.proveedor,
              fechaCorta(g.fecha),
              euros(Number(g.total)),
            ]
              .filter(Boolean)
              .join(" · "),
            href: `/admin/gastos/${g.id}`,
            icono: "gastos",
          });
        }

        setResultadosBd(items);
      } catch {
        if (peticionRef.current === idPeticion) setResultadosBd([]);
      } finally {
        if (peticionRef.current === idPeticion) setBuscando(false);
      }
    }, 180);

    return () => clearTimeout(temporizador);
  }, [abierto, consultaLimpia]);

  const comandosFiltrados = useMemo(() => {
    const q = consulta.trim().toLowerCase();
    if (!q) return COMANDOS;
    return COMANDOS.filter((c) =>
      `${c.etiqueta} ${c.descripcion} ${c.grupo} ${c.palabrasClave ?? ""}`.toLowerCase().includes(q),
    );
  }, [consulta]);

  const filtrados = useMemo<ElementoPaleta[]>(() => {
    if (!consultaLimpia) return comandosFiltrados;
    return [...resultadosBd, ...comandosFiltrados];
  }, [consultaLimpia, resultadosBd, comandosFiltrados]);

  const grupos = useMemo(() => {
    const orden: GrupoResultado[] = consultaLimpia
      ? [
          "Documentos",
          "Archivos sin asignar",
          "Clientes",
          "Campañas",
          "Gastos",
          "Acciones rápidas",
          "Riesgo y tablero",
          "Navegación",
        ]
      : ["Acciones rápidas", "Riesgo y tablero", "Navegación"];
    return orden
      .map((nombre) => ({
        nombre,
        items: filtrados.filter((c) => c.grupo === nombre),
      }))
      .filter((g) => g.items.length > 0);
  }, [consultaLimpia, filtrados]);

  function cerrar() {
    peticionRef.current += 1;
    setAbierto(false);
    setConsulta("");
    setResultadosBd([]);
    setBuscando(false);
    setIndiceActivo(0);
    const previo = focoPrevioRef.current;
    focoPrevioRef.current = null;
    if (previo && typeof previo.focus === "function") {
      requestAnimationFrame(() => previo.focus());
    }
  }

  function ejecutar(elemento: ElementoPaleta) {
    cerrar();
    if (elemento.externo) {
      window.open(elemento.href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(elemento.href);
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
            placeholder="Buscar por nº factura, archivo, cliente o comando…"
            aria-label="Buscar documentos, archivos, clientes o comandos"
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
          {buscando && (
            <p className="px-esp3 py-esp2 text-xs text-texto-terciario" role="status">
              Buscando en documentos y archivos…
            </p>
          )}
          {grupos.length === 0 ? (
            !buscando && (
              <p className="px-esp3 py-esp6 text-center text-sm text-texto-terciario">
                No hay resultados para «{consulta}».
              </p>
            )
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.nombre} className="mb-esp2 last:mb-0">
                <p className="px-esp3 py-1.5 text-etiqueta uppercase text-texto-secundario">
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
