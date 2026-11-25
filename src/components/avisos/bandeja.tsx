"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { desenvolver } from "@/lib/accion";
import { marcarLeidas } from "@/lib/push/acciones";

import type { NotificacionBandeja } from "@/lib/tipos-ui";
export type { NotificacionBandeja };

/**
 * Lista de los últimos avisos. Al abrirla se marcan como leídos (con un pequeño retraso, para que se vea
 * qué era nuevo) y se actualiza el contador de la barra.
 */
export function Bandeja({ avisos }: { avisos: NotificacionBandeja[] }) {
  const router = useRouter();
  const hayNuevos = avisos.some((a) => !a.leida);

  useEffect(() => {
    if (!hayNuevos) return;
    const t = setTimeout(() => {
      void desenvolver(marcarLeidas())
        .then(() => router.refresh())
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [hayNuevos, router]);

  if (avisos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-borde-default px-esp4 py-esp5 text-center text-sm text-texto-terciario">
        Todavía no has recibido ningún aviso.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-borde-default overflow-hidden rounded-xl border border-borde-default bg-fondo-superficie">
      {avisos.map((a) => {
        const contenido = (
          <>
            <span
              aria-hidden="true"
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.leida ? "bg-transparent" : "bg-fondo-marca")}
            />
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm text-texto-primario", !a.leida && "font-semibold")}>{a.titulo}</span>
              <span className="block text-sm text-texto-secundario">{a.cuerpo}</span>
              <span className="block text-xs text-texto-terciario">{a.creada}</span>
            </span>
            {a.url && (
              <Icono
                nombre="chevron"
                size={16}
                className="mt-1 text-icono-secundario transition-transform duration-rapida ease-salida group-hover:translate-x-0.5"
              />
            )}
          </>
        );
        return (
          <li key={a.id}>
            {a.url ? (
              <Link
                href={a.url}
                className="group flex items-start gap-esp3 px-esp4 py-esp3 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil"
              >
                {contenido}
              </Link>
            ) : (
              <div className="flex items-start gap-esp3 px-esp4 py-esp3">{contenido}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
