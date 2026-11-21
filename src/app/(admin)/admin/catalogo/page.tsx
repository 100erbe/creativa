import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { contarNoLeidos } from "@/lib/push/bandeja";
import {
  VistaCatalogo,
  type CategoriaAdmin,
  type ProductoAdmin,
} from "./controles";

export const dynamic = "force-dynamic";

export default async function PaginaCatalogo({
  searchParams,
}: {
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { nuevo } = await searchParams;
  const supabase = await createClient();

  const [resCategorias, resProductos] = await Promise.all([
    supabase
      .from("categorias")
      .select("id, codigo, nombre, orden")
      .order("orden")
      .order("nombre"),
    supabase
      .from("productos")
      .select(
        "id, codigo, categoria_id, nombre, descripcion_factura, material, unidad_venta, admite_medida_libre, permite_fabricacion, permite_instalacion, instalable_en_campana, precio_fabricacion, precio_instalacion, pedido_minimo, iva_pct, activo, notas, categorias(nombre, orden), formatos(id, codigo, nombre, ancho_cm, alto_cm, precio_fabricacion, precio_instalacion, alias, activo)",
      )
      .order("codigo"),
  ]);
  lanzarSiError(resCategorias, resProductos);

  const categorias: CategoriaAdmin[] = resCategorias.data ?? [];
  const productos: ProductoAdmin[] = (resProductos.data ?? [])
    .map((p) => {
      const cat = Array.isArray(p.categorias) ? p.categorias[0] : p.categorias;
      return {
        id: p.id,
        codigo: p.codigo,
        categoriaId: p.categoria_id,
        categoriaNombre: cat?.nombre ?? "Otros",
        ordenCategoria: cat?.orden ?? 99,
        nombre: p.nombre,
        descripcionFactura: p.descripcion_factura,
        material: p.material,
        unidadVenta: p.unidad_venta,
        admiteMedidaLibre: p.admite_medida_libre,
        permiteFabricacion: p.permite_fabricacion,
        permiteInstalacion: p.permite_instalacion,
        instalableEnCampana: p.instalable_en_campana,
        precioFabricacion: p.precio_fabricacion == null ? null : Number(p.precio_fabricacion),
        precioInstalacion: p.precio_instalacion == null ? null : Number(p.precio_instalacion),
        pedidoMinimo: p.pedido_minimo == null ? null : Number(p.pedido_minimo),
        ivaPct: Number(p.iva_pct),
        activo: p.activo,
        notas: p.notas,
        formatos: (p.formatos ?? [])
          .map((f) => ({
            id: f.id,
            codigo: f.codigo,
            nombre: f.nombre,
            anchoCm: f.ancho_cm == null ? null : Number(f.ancho_cm),
            altoCm: f.alto_cm == null ? null : Number(f.alto_cm),
            precioFabricacion: f.precio_fabricacion == null ? null : Number(f.precio_fabricacion),
            precioInstalacion: f.precio_instalacion == null ? null : Number(f.precio_instalacion),
            alias: f.alias ?? [],
            activo: f.activo,
          }))
          .sort((a, b) => (a.anchoCm ?? 99999) - (b.anchoCm ?? 99999) || a.nombre.localeCompare(b.nombre)),
      };
    })
    .sort((a, b) => a.ordenCategoria - b.ordenCategoria || a.codigo.localeCompare(b.codigo));

  return (
    <VistaCatalogo
      categorias={categorias}
      productos={productos}
      nuevoInicial={nuevo === "1"}
      noLeidos={await contarNoLeidos()}
    />
  );
}
