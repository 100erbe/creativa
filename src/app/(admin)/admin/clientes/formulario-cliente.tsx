"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Boton } from "@/components/ui/boton";
import {
  REGIMENES_IVA,
  TIPOS_CLIENTE,
  TIPOS_DOCUMENTO_ID,
} from "@/lib/clientes";
import { guardarCliente, type EstadoFormulario } from "./acciones";

export type DatosCliente = {
  id?: number;
  razon_social?: string;
  nombre_comercial?: string | null;
  tipo_persona?: string;
  tipo_documento?: string;
  numero_documento?: string | null;
  direccion?: string | null;
  codigo_postal?: string | null;
  municipio?: string | null;
  provincia?: string | null;
  pais?: string | null;
  email_facturacion?: string | null;
  telefono?: string | null;
  web?: string | null;
  tipo_cliente?: string;
  grupo_id?: number | null;
  regimen_iva?: string;
  motivo_exencion?: string | null;
  forma_pago_id?: number | null;
  cuenta_cobro_id?: number | null;
  descuento_habitual?: number | null;
  notas?: string | null;
};

type Opcion = { id: number; etiqueta: string };

const entrada =
  "h-9 w-full rounded-md border border-borde-campo bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco";

function Campo({
  etiqueta,
  ayuda,
  children,
  className,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-xs font-medium text-texto-secundario">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-texto-terciario">{ayuda}</span>}
    </label>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
      <h2 className="text-base font-semibold text-texto-primario">{titulo}</h2>
      <div className="grid grid-cols-1 gap-esp4 md:grid-cols-2">{children}</div>
    </div>
  );
}

export function FormularioCliente({
  inicial,
  grupos,
  formasPago,
  cuentas,
}: {
  inicial?: DatosCliente;
  grupos: Opcion[];
  formasPago: Opcion[];
  cuentas: Opcion[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(guardarCliente, {});
  const [regimen, setRegimen] = useState(inicial?.regimen_iva ?? "general");
  const editando = inicial?.id != null;
  const necesitaMotivo = regimen === "exento" || regimen === "intracomunitario";

  return (
    <form action={accion} className="flex flex-col gap-esp5">
      {editando && <input type="hidden" name="id" value={inicial?.id} />}

      <Seccion titulo="Datos fiscales">
        <Campo etiqueta="Razón social *" className="md:col-span-2">
          <input name="razon_social" defaultValue={inicial?.razon_social} required className={entrada} />
        </Campo>
        <Campo etiqueta="Nombre comercial">
          <input name="nombre_comercial" defaultValue={inicial?.nombre_comercial ?? ""} className={entrada} />
        </Campo>
        <Campo etiqueta="Tipo de persona">
          <select name="tipo_persona" defaultValue={inicial?.tipo_persona ?? "juridica"} className={entrada}>
            <option value="juridica">Jurídica (empresa)</option>
            <option value="fisica">Física (autónomo / particular)</option>
          </select>
        </Campo>
        <Campo etiqueta="Tipo de documento">
          <select name="tipo_documento" defaultValue={inicial?.tipo_documento ?? "CIF"} className={entrada}>
            {TIPOS_DOCUMENTO_ID.map((t) => (
              <option key={t} value={t}>
                {t === "VAT_UE" ? "VAT (UE)" : t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Número de documento">
          <input name="numero_documento" defaultValue={inicial?.numero_documento ?? ""} className={entrada} />
        </Campo>
      </Seccion>

      <Seccion titulo="Dirección y contacto">
        <Campo etiqueta="Dirección" className="md:col-span-2">
          <input name="direccion" defaultValue={inicial?.direccion ?? ""} className={entrada} />
        </Campo>
        <Campo etiqueta="Código postal">
          <input name="codigo_postal" defaultValue={inicial?.codigo_postal ?? ""} className={entrada} />
        </Campo>
        <Campo etiqueta="Municipio">
          <input name="municipio" defaultValue={inicial?.municipio ?? ""} className={entrada} />
        </Campo>
        <Campo etiqueta="Provincia">
          <input name="provincia" defaultValue={inicial?.provincia ?? ""} className={entrada} />
        </Campo>
        <Campo etiqueta="País (2 letras)">
          <input name="pais" defaultValue={inicial?.pais?.trim() || "ES"} maxLength={2} className={entrada} />
        </Campo>
        <Campo etiqueta="Email de facturación">
          <input name="email_facturacion" type="email" defaultValue={inicial?.email_facturacion ?? ""} className={entrada} />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={inicial?.telefono ?? ""} className={entrada} />
        </Campo>
        <Campo etiqueta="Web" className="md:col-span-2">
          <input name="web" defaultValue={inicial?.web ?? ""} className={entrada} />
        </Campo>
      </Seccion>

      <Seccion titulo="Condiciones comerciales">
        <Campo etiqueta="Tipo de cliente">
          <select name="tipo_cliente" defaultValue={inicial?.tipo_cliente ?? "marca_empresa"} className={entrada}>
            {TIPOS_CLIENTE.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Grupo empresarial">
          <select name="grupo_id" defaultValue={inicial?.grupo_id ?? ""} className={entrada}>
            <option value="">Ninguno</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Régimen de IVA">
          <select
            name="regimen_iva"
            value={regimen}
            onChange={(e) => setRegimen(e.target.value)}
            className={entrada}
          >
            {REGIMENES_IVA.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          etiqueta={necesitaMotivo ? "Motivo de la exención *" : "Motivo de la exención"}
          ayuda={necesitaMotivo ? "Obligatorio para este régimen; sale en la factura." : "Solo se usa en exentos e intracomunitarios."}
        >
          <input
            name="motivo_exencion"
            defaultValue={inicial?.motivo_exencion ?? ""}
            disabled={!necesitaMotivo}
            required={necesitaMotivo}
            className={entrada + " disabled:bg-fondo-sutil disabled:opacity-60"}
          />
        </Campo>
        <Campo etiqueta="Forma de pago">
          <select name="forma_pago_id" defaultValue={inicial?.forma_pago_id ?? ""} className={entrada}>
            <option value="">Sin definir</option>
            {formasPago.map((f) => (
              <option key={f.id} value={f.id}>
                {f.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Cuenta de cobro">
          <select name="cuenta_cobro_id" defaultValue={inicial?.cuenta_cobro_id ?? ""} className={entrada}>
            <option value="">Sin definir</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Descuento habitual (%)">
          <input
            name="descuento_habitual"
            inputMode="decimal"
            defaultValue={String(inicial?.descuento_habitual ?? 0)}
            className={entrada}
          />
        </Campo>
      </Seccion>

      <Seccion titulo="Notas internas">
        <Campo etiqueta="Notas" className="md:col-span-2">
          <textarea
            name="notas"
            rows={3}
            defaultValue={inicial?.notas ?? ""}
            className="rounded-md border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-sm text-texto-primario outline-none focus:border-borde-foco"
          />
        </Campo>
      </Seccion>

      {estado.error && (
        <p className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp4 py-esp3 text-sm text-texto-peligro">
          {estado.error}
        </p>
      )}

      <div className="flex gap-esp3">
        <Link href={editando ? `/admin/clientes/${inicial?.id}` : "/admin/clientes"}>
          <Boton type="button" variante="secundario">
            Cancelar
          </Boton>
        </Link>
        <Boton type="submit" cargando={pendiente}>
          {editando ? "Guardar cambios" : "Crear cliente"}
        </Boton>
      </div>
    </form>
  );
}
