"use client";

import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { confirmar } from "@/components/ui/dialogos";
import { createClient } from "@/lib/supabase/client";
import { liberarDispositivo } from "@/lib/push/cliente";

/** Cerrar sesión: en la cabecera (no junto a las pestañas, donde se tocaba sin querer) y con confirmación. */
export function BotonSalir() {
  const router = useRouter();

  async function salir() {
    if (!(await confirmar("¿Cerrar la sesión en este móvil?", { aceptar: "Cerrar sesión" }))) return;
    await liberarDispositivo(); // antes de cerrar sesión: necesita la sesión para borrar el dispositivo
    await createClient().auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  return (
    <button
      onClick={salir}
      aria-label="Cerrar sesión"
      className="absolute right-esp2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-icono-secundario hover:bg-fondo-sutil"
    >
      <Icono nombre="salir" size={20} />
    </button>
  );
}
