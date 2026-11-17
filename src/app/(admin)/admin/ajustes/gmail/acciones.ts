"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { accion } from "@/lib/accion";
import { desconectarCuenta } from "@/lib/gmail";

export const desconectarGmail = accion(async () => {
  await exigirAdmin();
  await desconectarCuenta();
  revalidatePath("/admin/ajustes/gmail");
});
