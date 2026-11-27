import { createClient } from "@/lib/supabase/server";
import { articulosDeDocumento } from "@/lib/campanas/articulos";
import { resumirCobrosPendientes } from "@/lib/cobros-pendientes";
import { hoyEnEspana } from "@/lib/estado-cuenta";
import { PasoCliente } from "./paso-cliente";
import { PasoLineas, type ProductoCatalogo, type SituacionCliente } from "./paso-lineas";
import { PasoCampana } from "./paso-campana";
import type { TipoNuevoDocumento } from "./acciones";
import { esGeometriaZona, esTipoUbicacion, type TipoUbicacion } from "@/lib/mapa/zonas";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoDocumento({
  searchParams,
}: {
  searchParams: Promise<{ documento?: string; paso?: string; tipo?: string; cliente?: string }>;
}) {
  const { documento, paso, tipo, cliente: clienteParam } = await searchParams;
  const supabase = await createClient();

  const cargarClientes = async () =>
    (
      await supabase
        .from("clientes")
        .select("id, razon_social, nombre_comercial, numero_documento")
        .eq("activo", true)
        .order("razon_social")
    ).data ?? [];

  // Sin documento todavía → Paso 1: tipo + cliente.
  if (!documento) {
    const tipoInicial = (["presupuesto", "albaran", "factura"] as const).find((t) => t === tipo);
    return (
      <PasoCliente
        clientes={await cargarClientes()}
        tipoInicial={tipoInicial as TipoNuevoDocumento}
        clienteInicialId={Number(clienteParam) || undefined}
      />
    );
  }

  const documentoId = Number(documento);
  const { data: doc } = await supabase
    .from("documentos")
    .select(
      "id, tipo, estado, cliente_id, documento_origen_id, suma_lineas, descuento_global_pct, base_imponible, cuota_iva, total, campana_id, clientes(razon_social, nombre_comercial, descuento_habitual)",
    )
    .eq("id", documentoId)
    .maybeSingle();

  if (!doc) {
    return <p className="text-sm text-texto-peligro">No se ha encontrado el documento #{documentoId}.</p>;
  }
  if (doc.estado !== "borrador") {
    return (
      <p className="text-sm text-texto-secundario">
        Este documento ya está emitido y no se puede editar.{" "}
        <a href={`/admin/documentos/${doc.id}`} className="font-medium text-texto-marca">
          Ver documento
        </a>
      </p>
    );
  }

  const cliente = Array.isArray(doc.clientes) ? doc.clientes[0] : doc.clientes;
  const cabecera = {
    id: doc.id,
    tipo: doc.tipo,
    cliente_id: doc.cliente_id,
    cliente: cliente?.nombre_comercial || cliente?.razon_social || "Cliente",
    descuento_habitual: Number(cliente?.descuento_habitual ?? 0),
    suma_lineas: Number(doc.suma_lineas),
    descuento_global_pct: Number(doc.descuento_global_pct ?? 0),
    base_imponible: Number(doc.base_imponible),
    cuota_iva: Number(doc.cuota_iva),
    total: Number(doc.total),
    campana_id: doc.campana_id,
  };

  // Paso 1 de nuevo: cambiar el cliente del borrador.
  if (paso === "cliente") {
    return (
      <PasoCliente
        clientes={await cargarClientes()}
        documento={{
          id: doc.id,
          tipo: doc.tipo,
          cliente_id: doc.cliente_id,
          // Una factura convertida o una versión de presupuesto conserva su tipo.
          tipoFijo: doc.documento_origen_id != null || !["presupuesto", "albaran", "factura"].includes(doc.tipo),
        }}
      />
    );
  }

  // Paso 3: campaña (dónde y cómo se instala).
  if (paso === "campana") {
    const [{ data: campanas }, { data: puntos }, articulos] = await Promise.all([
      supabase
        .from("campanas")
        .select("id, nombre, fecha_inicio, fecha_fin, estado")
        .eq("cliente_id", doc.cliente_id)
        .neq("estado", "cancelada")
        .order("creado_en", { ascending: false }),
      doc.campana_id
        ? supabase
            .from("puntos_campana")
            .select(
              "id, nombre, tipo_soporte, linea_id, piezas, direccion, latitud, longitud, tipo_ubicacion, radio_metros, geometria, fecha_colocacion_prevista, fecha_retirada_prevista, estado, notas",
            )
            .eq("campana_id", doc.campana_id)
            .order("id")
        : Promise.resolve({ data: [] }),
      articulosDeDocumento(supabase, documentoId),
    ]);
    return (
      <PasoCampana
        documento={cabecera}
        campanas={campanas ?? []}
        articulos={articulos.map((a) => ({
          id: a.id,
          descripcion: a.descripcion,
          nombre: a.nombre,
          artista: a.artista,
          piezas: a.piezas,
          unidad: a.unidad,
        }))}
        puntos={(puntos ?? []).map((p) => ({
          ...p,
          piezas: p.piezas == null ? null : Number(p.piezas),
          latitud: Number(p.latitud),
          longitud: Number(p.longitud),
          tipo_ubicacion: esTipoUbicacion(p.tipo_ubicacion) ? p.tipo_ubicacion : ("punto" as TipoUbicacion),
          radio_metros: p.radio_metros == null ? null : Number(p.radio_metros),
          geometria: esGeometriaZona(p.geometria) ? p.geometria : null,
        }))}
      />
    );
  }

  // Paso 2: artículos.
  const [
    { data: lineas },
    { data: productos },
    { data: recientes },
    { data: categorias },
    { data: cobrosCliente },
    { data: metaDocsCliente },
  ] = await Promise.all([
    supabase
      .from("lineas_documento")
      .select("id, descripcion, artista, piezas, cantidad, unidad, precio_unitario, recargo_acabados, descuento_pct, importe, coste_unitario")
      .eq("documento_id", documentoId)
      .order("orden"),
    supabase
      .from("productos")
      .select(
        "id, codigo, nombre, descripcion_factura, unidad_venta, admite_medida_libre, permite_fabricacion, permite_instalacion, precio_fabricacion, precio_instalacion, coste_fabricacion, coste_instalacion, pedido_minimo, iva_pct, categorias(id, nombre, orden), formatos(id, codigo, nombre, ancho_cm, alto_cm, precio_fabricacion, precio_instalacion, coste_fabricacion, alias, activo)",
      )
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("v_lineas_recientes_cliente")
      .select("producto_id, formato_id, alcance, ultimo_precio, ultimo_descuento, usado_en")
      .eq("cliente_id", doc.cliente_id)
      .order("usado_en", { ascending: false })
      .limit(6),
    supabase
      .from("categorias")
      .select("id, nombre, orden")
      .order("orden")
      .order("nombre"),
    supabase
      .from("v_estado_cobro")
      .select("id, tipo, fecha, fecha_vencimiento, total, cobrado, pendiente, estado_cobro")
      .eq("cliente_id", doc.cliente_id),
    supabase
      .from("documentos")
      .select("id, estado, documento_origen_id")
      .eq("cliente_id", doc.cliente_id)
      .in("tipo", ["factura", "rectificativa"])
      .neq("estado", "borrador"),
  ]);

  const hoy = new Date();
  const anioActual = Number(hoyEnEspana(hoy).slice(0, 4));
  const prefijoAnio = `${anioActual}-`;
  const resumenCobros = resumirCobrosPendientes(cobrosCliente ?? [], metaDocsCliente ?? [], hoy);
  const delAnio = resumenCobros.vigentes.filter((d) => d.fecha?.startsWith(prefijoAnio));
  const situacionCliente: SituacionCliente = {
    anio: anioActual,
    facturadoAnio: Math.round(delAnio.reduce((s, d) => s + Number(d.total ?? 0), 0) * 100) / 100,
    cobradoAnio: Math.round(delAnio.reduce((s, d) => s + Number(d.cobrado ?? 0), 0) * 100) / 100,
    pendiente: resumenCobros.totalPendiente,
    vencido: resumenCobros.sumaSaldo(resumenCobros.vencidas),
    facturasVencidas: resumenCobros.vencidas.length,
    maxDiasVencido: resumenCobros.vencidas.reduce((m, d) => Math.max(m, d.aging.diasVencido), 0),
    tieneCriticas90: resumenCobros.criticas90.length > 0,
  };

  const catalogo: ProductoCatalogo[] = (productos ?? [])
    .map((p) => {
      const cat = Array.isArray(p.categorias) ? p.categorias[0] : p.categorias;
      return {
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        descripcionFactura: p.descripcion_factura,
        unidad: p.unidad_venta,
        medidaLibre: p.admite_medida_libre,
        fabricacion: p.permite_fabricacion,
        instalacion: p.permite_instalacion,
        precioFabricacion: p.precio_fabricacion == null ? null : Number(p.precio_fabricacion),
        precioInstalacion: p.precio_instalacion == null ? null : Number(p.precio_instalacion),
        costeFabricacion: p.coste_fabricacion == null ? null : Number(p.coste_fabricacion),
        costeInstalacion: p.coste_instalacion == null ? null : Number(p.coste_instalacion),
        pedidoMinimo: p.pedido_minimo == null ? null : Number(p.pedido_minimo),
        ivaPct: Number(p.iva_pct),
        categoriaId: cat?.id ?? null,
        categoria: cat?.nombre ?? "Otros",
        ordenCategoria: cat?.orden ?? 99,
        formatos: (p.formatos ?? [])
          .filter((f) => f.activo)
          .map((f) => ({
            id: f.id,
            codigo: f.codigo,
            nombre: f.nombre,
            ancho: f.ancho_cm == null ? null : Number(f.ancho_cm),
            alto: f.alto_cm == null ? null : Number(f.alto_cm),
            precioFabricacion: f.precio_fabricacion == null ? null : Number(f.precio_fabricacion),
            precioInstalacion: f.precio_instalacion == null ? null : Number(f.precio_instalacion),
            costeFabricacion: f.coste_fabricacion == null ? null : Number(f.coste_fabricacion),
            alias: f.alias ?? [],
          }))
          .sort((a, b) => (a.ancho ?? 99999) - (b.ancho ?? 99999) || a.nombre.localeCompare(b.nombre)),
      };
    })
    .sort((a, b) => a.ordenCategoria - b.ordenCategoria || a.nombre.localeCompare(b.nombre));

  return (
    <PasoLineas
      documento={cabecera}
      situacionCliente={situacionCliente}
      lineas={(lineas ?? []).map((l) => ({
        id: l.id,
        descripcion: l.descripcion,
        artista: l.artista,
        piezas: Number(l.piezas),
        cantidad: Number(l.cantidad),
        unidad: l.unidad,
        precio_unitario: Number(l.precio_unitario),
        recargo_acabados: Number(l.recargo_acabados),
        descuento_pct: Number(l.descuento_pct),
        importe: Number(l.importe),
        coste_unitario: l.coste_unitario == null ? null : Number(l.coste_unitario),
      }))}
      catalogo={catalogo}
      categorias={categorias ?? []}
      recientes={(recientes ?? []).flatMap((r) =>
        r.producto_id != null && r.alcance != null
          ? [
              {
                producto_id: r.producto_id,
                formato_id: r.formato_id,
                alcance: r.alcance,
                ultimo_precio: Number(r.ultimo_precio ?? 0),
                ultimo_descuento: Number(r.ultimo_descuento ?? 0),
              },
            ]
          : [],
      )}
    />
  );
}
