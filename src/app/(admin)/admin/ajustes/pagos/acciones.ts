"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { accion } from "@/lib/accion";

function refrescar() {
  revalidatePath("/admin/ajustes/pagos");
}

export const guardarFormaPago = accion(
  async (id: number | null, d: { nombre: string; diasVencimiento: number; textoFactura: string }) => {
    await exigirAdmin();
    const nombre = d.nombre.trim();
    if (!nombre) throw new Error("Pon un nombre a la forma de pago.");
    if (!Number.isInteger(d.diasVencimiento) || d.diasVencimiento < 0 || d.diasVencimiento > 365) {
      throw new Error("Los días de vencimiento van de 0 a 365.");
    }
    const supabase = await createClient();

    const fila = { nombre, dias_vencimiento: d.diasVencimiento, texto_factura: d.textoFactura.trim() || null };
    const { error } = id == null
      ? await supabase.from("formas_pago").insert(fila)
      : await supabase.from("formas_pago").update(fila).eq("id", id);
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe una forma de pago con ese nombre.");
      throw new Error(error.message);
    }
    refrescar();
  },
);

export const eliminarFormaPago = accion(async (id: number) => {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("formas_pago").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") throw new Error("Está en uso por algún cliente o documento y no se puede eliminar.");
    throw new Error(error.message);
  }
  refrescar();
});

const IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;

export const guardarCuenta = accion(
  async (id: number | null, d: { banco: string; iban: string; porDefecto: boolean; activa: boolean }) => {
    await exigirAdmin();
    const banco = d.banco.trim();
    const iban = d.iban.replace(/\s+/g, "").toUpperCase();
    if (!banco) throw new Error("Pon el nombre del banco.");
    if (!IBAN.test(iban)) throw new Error("El IBAN no parece válido (ej. ES12 3456 7890 1234 5678 9012).");
    if (d.porDefecto && !d.activa) throw new Error("La cuenta por defecto debe estar activa.");
    const supabase = await createClient();

    // Solo puede haber una cuenta por defecto: se quita de las demás antes de ponerla.
    if (d.porDefecto) {
      const { error } = await supabase.from("cuentas_bancarias").update({ por_defecto: false }).eq("por_defecto", true);
      if (error) throw new Error(error.message);
    }
    const fila = { banco, iban, por_defecto: d.porDefecto, activa: d.activa };
    const { error } = id == null
      ? await supabase.from("cuentas_bancarias").insert(fila)
      : await supabase.from("cuentas_bancarias").update(fila).eq("id", id);
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe una cuenta con ese IBAN.");
      throw new Error(error.message);
    }
    refrescar();
  },
);
