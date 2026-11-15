import { createClient } from "@/lib/supabase/server";
import { PasoCliente } from "./paso-cliente";
import { PasoLineas, type ProductoCatalogo } from "./paso-lineas";
import { PasoCampana } from "./paso-campana";
import type { TipoNuevoDocumento } from "./acciones";

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
      "id, tipo, estado, cliente_id, suma_lineas, base_imponible, cuota_iva, total, campana_id, clientes(razon_social, nombre_comercial, descuento_habitual)",
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
        documento={{ id: doc.id, tipo: doc.tipo, cliente_id: doc.cliente_id }}
      />
    );
  }

  // Paso 3: campaña (dónde y cómo se instala).
  if (paso === "campana") {
    const [{ data: campanas }, { data: puntos }, { data: lineasDoc }] = await Promise.all([
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
              "id, nombre, tipo_soporte, linea_id, piezas, direccion, latitud, longitud, fecha_colocacion_prevista, fecha_retirada_prevista, estado, notas",
            )
            .eq("campana_id", doc.campana_id)
            .order("id")
        : Promise.resolve({ data: [] }),
      supabase
        .from("lineas_documento")
        .select("id, descripcion, articulo, artista, piezas, unidad, productos(nombre)")
        .eq("documento_id", documentoId)
        .order("orden"),
    ]);
    return (
      <PasoCampana
        documento={cabecera}
        campanas={campanas ?? []}
        articulos={(lineasDoc ?? []).map((l) => {
          const producto = Array.isArray(l.productos) ? l.productos[0] : l.productos;
          return {
          id: l.id,
          descripcion: l.descripcion,
          // Nombre corto para elegir el artículo: producto y formato, no el texto largo de la factura.
          nombre: producto?.nombre ? `${producto.nombre}${l.articulo ? ` · ${l.articulo}` : ""}` : l.descripcion,
          artista: l.artista,
          piezas: Number(l.piezas),
          unidad: l.unidad,
          };
        })}
        puntos={(puntos ?? []).map((p) => ({
          ...p,
          piezas: p.piezas == null ? null : Number(p.piezas),
          latitud: Number(p.latitud),
          longitud: Number(p.longitud),
        }))}
      />
    );
  }

  // Paso 2: artículos.
  const [{ data: lineas }, { data: productos }, { data: recientes }] = await Promise.all([
    supabase
      .from("lineas_documento")
      .select("id, descripcion, artista, piezas, cantidad, unidad, precio_unitario, recargo_acabados, descuento_pct, importe")
      .eq("documento_id", documentoId)
      .order("orden"),
    supabase
      .from("productos")
      .select(
        "id, nombre, unidad_venta, admite_medida_libre, permite_fabricacion, permite_instalacion, categorias(nombre, orden), formatos(id, nombre, ancho_cm, alto_cm, activo)",
      )
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("v_lineas_recientes_cliente")
      .select("producto_id, formato_id, alcance, ultimo_precio, ultimo_descuento, usado_en")
      .eq("cliente_id", doc.cliente_id)
      .order("usado_en", { ascending: false })
      .limit(6),
  ]);

  const catalogo: ProductoCatalogo[] = (productos ?? [])
    .map((p) => {
      const cat = Array.isArray(p.categorias) ? p.categorias[0] : p.categorias;
      return {
        id: p.id,
        nombre: p.nombre,
        unidad: p.unidad_venta,
        medidaLibre: p.admite_medida_libre,
        fabricacion: p.permite_fabricacion,
        instalacion: p.permite_instalacion,
        categoria: cat?.nombre ?? "Otros",
        ordenCategoria: cat?.orden ?? 99,
        formatos: (p.formatos ?? [])
          .filter((f) => f.activo)
          .map((f) => ({
            id: f.id,
            nombre: f.nombre,
            ancho: f.ancho_cm == null ? null : Number(f.ancho_cm),
            alto: f.alto_cm == null ? null : Number(f.alto_cm),
          })),
      };
    })
    .sort((a, b) => a.ordenCategoria - b.ordenCategoria || a.nombre.localeCompare(b.nombre));

  return (
    <PasoLineas
      documento={cabecera}
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
      }))}
      catalogo={catalogo}
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
