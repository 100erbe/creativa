"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { Campo } from "@/components/ui/campo";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { ETIQUETA_TIPO } from "@/lib/documentos";
import { TIPOS_CLIENTE, TIPOS_DOCUMENTO_ID } from "@/lib/clientes";
import { crearClienteRapido } from "../../clientes/acciones";
import { cambiarCliente, crearBorrador, type TipoNuevoDocumento } from "./acciones";

type Cliente = {
  id: number;
  razon_social: string;
  nombre_comercial: string | null;
  numero_documento: string | null;
};

const TIPOS: { valor: TipoNuevoDocumento; descripcion: string }[] = [
  { valor: "presupuesto", descripcion: "Oferta para que el cliente la acepte" },
  { valor: "albaran", descripcion: "Trabajo hecho, pendiente de facturar" },
  { valor: "factura", descripcion: "Documento fiscal con número correlativo" },
];

export function PasoCliente({
  clientes: clientesIniciales,
  documento,
  tipoInicial,
}: {
  clientes: Cliente[];
  /** Si viene, estamos cambiando el cliente de un borrador ya creado. */
  documento?: { id: number; tipo: string; cliente_id: number };
  tipoInicial?: TipoNuevoDocumento;
}) {
  const router = useRouter();
  const [clientes, setClientes] = useState(clientesIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoNuevoDocumento>(tipoInicial ?? "presupuesto");
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(
    clientesIniciales.find((c) => c.id === documento?.cliente_id) ?? null,
  );
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const filtrados = clientes.filter((c) =>
    `${c.razon_social} ${c.nombre_comercial ?? ""} ${c.numero_documento ?? ""}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );

  const etiquetaTipo = ETIQUETA_TIPO[documento?.tipo ?? tipo] ?? "documento";

  function continuar() {
    if (!seleccionado) return;
    setError(null);
    iniciar(async () => {
      try {
        if (documento) {
          if (seleccionado.id !== documento.cliente_id) await cambiarCliente(documento.id, seleccionado.id);
          router.push(`/admin/documentos/nuevo?documento=${documento.id}`);
        } else {
          const id = await crearBorrador(seleccionado.id, tipo);
          router.push(`/admin/documentos/nuevo?documento=${id}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo continuar.");
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-esp5">
      <div>
        <p className="text-xs text-texto-terciario">Documentos / Nuevo</p>
        <h1 className="text-2xl font-semibold text-texto-primario">
          {documento ? `Cambiar cliente del ${etiquetaTipo.toLowerCase()}` : `Nuevo ${etiquetaTipo.toLowerCase()}`}
        </h1>
      </div>
      <PasosDocumento actual={1} documentoId={documento?.id} />

      {!documento && (
        <div className="flex flex-col gap-esp2">
          <span className="text-xs font-medium text-texto-secundario">Tipo de documento</span>
          <div className="grid grid-cols-1 gap-esp2 sm:grid-cols-3">
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTipo(t.valor)}
                className={cn(
                  "flex flex-col rounded-lg border px-esp4 py-esp3 text-left",
                  tipo === t.valor
                    ? "border-borde-foco bg-fondo-marca-sutil"
                    : "border-borde-default bg-fondo-superficie hover:bg-fondo-sutil",
                )}
              >
                <span className="text-sm font-medium text-texto-primario">{ETIQUETA_TIPO[t.valor]}</span>
                <span className="text-xs text-texto-terciario">{t.descripcion}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-esp3">
        <Campo
          etiqueta="Buscar cliente"
          valor={busqueda}
          onCambio={setBusqueda}
          placeholder="Nombre o CIF…"
          className="flex-1"
        />
        <Boton variante="secundario" onClick={() => setCreando((v) => !v)}>
          <Icono nombre={creando ? "cerrar" : "mas"} size={16} />
          {creando ? "Cerrar" : "Nuevo cliente"}
        </Boton>
      </div>

      {creando && (
        <FormularioClienteRapido
          razonInicial={busqueda}
          onCreado={(c) => {
            setClientes((prev) => [c, ...prev]);
            setSeleccionado(c);
            setBusqueda("");
            setCreando(false);
          }}
        />
      )}

      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-lg border border-borde-default bg-fondo-superficie p-esp2">
        {filtrados.map((c) => (
          <button
            key={c.id}
            onClick={() => setSeleccionado(c)}
            className={cn(
              "flex items-center gap-esp3 rounded-md px-esp3 py-esp2 text-left",
              seleccionado?.id === c.id ? "bg-fondo-marca-sutil" : "hover:bg-fondo-sutil",
            )}
          >
            <span className="flex flex-1 flex-col">
              <span className="text-sm font-medium text-texto-primario">
                {c.nombre_comercial || c.razon_social}
              </span>
              <span className="text-xs text-texto-terciario">
                {c.razon_social} {c.numero_documento ? `· ${c.numero_documento}` : ""}
              </span>
            </span>
            {seleccionado?.id === c.id && <Icono nombre="check" size={16} className="text-icono-marca" />}
          </button>
        ))}
        {filtrados.length === 0 && (
          <div className="flex flex-col items-start gap-esp2 px-esp3 py-esp4">
            <p className="text-sm text-texto-terciario">Sin resultados.</p>
            {!creando && (
              <Boton tamano="s" variante="fantasma" onClick={() => setCreando(true)}>
                <Icono nombre="mas" size={14} />
                Crear «{busqueda}» como cliente nuevo
              </Boton>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-texto-peligro">{error}</p>}

      <div className="flex items-center gap-esp3">
        {seleccionado && (
          <p className="flex-1 text-sm text-texto-secundario">
            Cliente: <strong className="text-texto-primario">{seleccionado.nombre_comercial || seleccionado.razon_social}</strong>
          </p>
        )}
        <Boton
          disabled={!seleccionado || pendiente}
          cargando={pendiente}
          onClick={continuar}
          className="ml-auto"
        >
          Continuar
        </Boton>
      </div>
    </div>
  );
}

const entrada =
  "h-9 w-full rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco";

function FormularioClienteRapido({
  razonInicial,
  onCreado,
}: {
  razonInicial: string;
  onCreado: (c: Cliente) => void;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const campos = Object.fromEntries(
          [...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]),
        ) as Parameters<typeof crearClienteRapido>[0];
        setError(null);
        iniciar(async () => {
          const r = await crearClienteRapido(campos);
          if ("error" in r) setError(r.error);
          else onCreado(r.cliente);
        });
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-texto-primario">Nuevo cliente</h2>
        <p className="text-xs text-texto-terciario">
          Lo básico para el documento. El resto (forma de pago, contactos…) se completa luego en su ficha.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-esp3 md:grid-cols-2">
        <Etiqueta texto="Razón social *" className="md:col-span-2">
          <input name="razon_social" required minLength={2} defaultValue={razonInicial} autoFocus className={entrada} />
        </Etiqueta>
        <Etiqueta texto="Nombre comercial">
          <input name="nombre_comercial" className={entrada} />
        </Etiqueta>
        <Etiqueta texto="Tipo de cliente">
          <select name="tipo_cliente" defaultValue="marca_empresa" className={entrada}>
            {TIPOS_CLIENTE.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </Etiqueta>
        <Etiqueta texto="Tipo de persona">
          <select name="tipo_persona" defaultValue="juridica" className={entrada}>
            <option value="juridica">Jurídica (empresa)</option>
            <option value="fisica">Física (autónomo / particular)</option>
          </select>
        </Etiqueta>
        <div className="grid grid-cols-[100px_1fr] gap-esp2">
          <Etiqueta texto="Documento">
            <select name="tipo_documento" defaultValue="CIF" className={entrada}>
              {TIPOS_DOCUMENTO_ID.map((t) => (
                <option key={t} value={t}>
                  {t === "VAT_UE" ? "VAT" : t}
                </option>
              ))}
            </select>
          </Etiqueta>
          <Etiqueta texto="Número">
            <input name="numero_documento" placeholder="B12345678" className={entrada} />
          </Etiqueta>
        </div>
        <Etiqueta texto="Dirección" className="md:col-span-2">
          <input name="direccion" className={entrada} />
        </Etiqueta>
        <div className="grid grid-cols-[100px_1fr] gap-esp2">
          <Etiqueta texto="C.P.">
            <input name="codigo_postal" className={entrada} />
          </Etiqueta>
          <Etiqueta texto="Municipio">
            <input name="municipio" className={entrada} />
          </Etiqueta>
        </div>
        <Etiqueta texto="Provincia">
          <input name="provincia" className={entrada} />
        </Etiqueta>
        <Etiqueta texto="Email de facturación">
          <input name="email_facturacion" type="email" className={entrada} />
        </Etiqueta>
        <Etiqueta texto="Teléfono">
          <input name="telefono" className={entrada} />
        </Etiqueta>
      </div>
      {error && <p className="text-sm text-texto-peligro">{error}</p>}
      <Boton type="submit" cargando={pendiente} className="self-end">
        Crear y seleccionar
      </Boton>
    </form>
  );
}

function Etiqueta({
  texto,
  className,
  children,
}: {
  texto: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-texto-secundario">{texto}</span>
      {children}
    </label>
  );
}
