"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { Campo } from "@/components/ui/campo";
import { Boton } from "@/components/ui/boton";
import { crearBorrador } from "./acciones";

type Cliente = {
  id: number;
  razon_social: string;
  nombre_comercial: string | null;
  numero_documento: string | null;
};

export function PasoCliente({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null);
  const [pendiente, iniciar] = useTransition();

  const filtrados = clientes.filter((c) =>
    `${c.razon_social} ${c.nombre_comercial ?? ""}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );

  function continuar() {
    if (!seleccionado) return;
    iniciar(async () => {
      const id = await crearBorrador(seleccionado.id);
      router.push(`/admin/documentos/nuevo?documento=${id}`);
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-esp5">
      <div>
        <p className="text-xs text-texto-terciario">Documentos / Nuevo</p>
        <h1 className="text-2xl font-semibold text-texto-primario">Nuevo presupuesto</h1>
      </div>
      <PasosDocumento actual={1} />

      <Campo etiqueta="Buscar cliente" valor={busqueda} onCambio={setBusqueda} placeholder="Nombre o CIF…" />

      <div className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-lg border border-borde-default bg-fondo-superficie p-esp2">
        {filtrados.map((c) => (
          <button
            key={c.id}
            onClick={() => setSeleccionado(c)}
            className={`flex flex-col rounded-md px-esp3 py-esp2 text-left ${
              seleccionado?.id === c.id ? "bg-fondo-marca-sutil" : "hover:bg-fondo-sutil"
            }`}
          >
            <span className="text-sm font-medium text-texto-primario">
              {c.nombre_comercial || c.razon_social}
            </span>
            <span className="text-xs text-texto-terciario">
              {c.razon_social} {c.numero_documento ? `· ${c.numero_documento}` : ""}
            </span>
          </button>
        ))}
        {filtrados.length === 0 && (
          <p className="px-esp3 py-esp4 text-sm text-texto-terciario">Sin resultados.</p>
        )}
      </div>

      <Boton
        disabled={!seleccionado || pendiente}
        cargando={pendiente}
        onClick={continuar}
        className="self-end"
      >
        Continuar
      </Boton>
    </div>
  );
}
