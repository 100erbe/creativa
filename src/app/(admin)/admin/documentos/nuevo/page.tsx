import { createClient } from "@/lib/supabase/server";
import { PasoCliente } from "./paso-cliente";
import { PasoLineas } from "./paso-lineas";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoDocumento({
  searchParams,
}: {
  searchParams: Promise<{ documento?: string }>;
}) {
  const { documento } = await searchParams;
  const supabase = await createClient();

  // Sin documento todavía → Paso 1: elegir cliente.
  if (!documento) {
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, razon_social, nombre_comercial, numero_documento")
      .eq("activo", true)
      .order("razon_social");

    return <PasoCliente clientes={clientes ?? []} />;
  }

  // Con documento → Paso 2: líneas.
  const documentoId = Number(documento);

  const [{ data: doc }, { data: lineas }, { data: plantillas }, { data: recientes }] =
    await Promise.all([
      supabase
        .from("documentos")
        .select(
          "id, cliente_id, cliente_razon_social, suma_lineas, base_imponible, cuota_iva, total, campana_id, forma_pago_id, texto_forma_pago",
        )
        .eq("id", documentoId)
        .single(),
      supabase
        .from("lineas_documento")
        .select("id, descripcion, piezas, unidad, precio_unitario, descuento_pct, importe")
        .eq("documento_id", documentoId)
        .order("orden"),
      supabase
        .from("plantillas_linea")
        .select("id, nombre, producto_id, formato_id, alcance, piezas_sugeridas, productos(nombre)")
        .eq("activo", true)
        .order("orden_visual")
        .limit(8),
      supabase
        .from("v_lineas_recientes_cliente")
        .select("producto_id, producto, formato_id, formato, alcance, ultimo_precio, usado_en")
        .limit(4),
    ]);

  if (!doc) {
    return (
      <p className="text-sm text-texto-peligro">
        No se ha encontrado el documento #{documentoId}.
      </p>
    );
  }

  return (
    <PasoLineas
      documento={doc}
      lineas={lineas ?? []}
      plantillas={plantillas ?? []}
      recientes={(recientes ?? []).filter((r) => r.producto_id)}
    />
  );
}
