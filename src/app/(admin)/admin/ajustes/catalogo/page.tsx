import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Icono } from "@/components/ui/iconos";
import { Catalogo, type ProductoAjuste } from "./controles";

export const dynamic = "force-dynamic";

export default async function PaginaCatalogo() {
  const supabase = await createClient();
  const resultado = await supabase
    .from("productos")
    .select(
      "id, codigo, nombre, unidad_venta, precio_fabricacion, precio_instalacion, iva_pct, activo, categorias(nombre, orden), formatos(id, codigo, nombre, precio_fabricacion, precio_instalacion, activo)",
    )
    .order("codigo");
  lanzarSiError(resultado);

  const productos: ProductoAjuste[] = (resultado.data ?? [])
    .map((p) => {
      const cat = Array.isArray(p.categorias) ? p.categorias[0] : p.categorias;
      return {
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        unidad: p.unidad_venta,
        precioFabricacion: p.precio_fabricacion == null ? null : Number(p.precio_fabricacion),
        precioInstalacion: p.precio_instalacion == null ? null : Number(p.precio_instalacion),
        ivaPct: Number(p.iva_pct),
        activo: p.activo,
        categoria: cat?.nombre ?? "Otros",
        ordenCategoria: cat?.orden ?? 99,
        formatos: (p.formatos ?? []).map((f) => ({
          id: f.id,
          nombre: f.nombre,
          precioFabricacion: f.precio_fabricacion == null ? null : Number(f.precio_fabricacion),
          precioInstalacion: f.precio_instalacion == null ? null : Number(f.precio_instalacion),
          activo: f.activo,
        })),
      };
    })
    .sort((a, b) => a.ordenCategoria - b.ordenCategoria || a.codigo.localeCompare(b.codigo));

  return (
    <div className="flex max-w-4xl flex-col gap-esp5">
      <div className="flex flex-col gap-esp2">
        <Link
          href="/admin/ajustes"
          className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          Ajustes
        </Link>
        <h1 className="text-2xl font-semibold text-texto-primario">Catálogo y precios</h1>
        <p className="text-sm text-texto-secundario">
          Un cambio de precio solo afecta a las líneas que añadas a partir de ahora: las que ya están en un documento
          conservan el suyo. Un precio propio de cliente (en su ficha) manda sobre el del catálogo.
        </p>
      </div>
      <Catalogo productos={productos} />
    </div>
  );
}
