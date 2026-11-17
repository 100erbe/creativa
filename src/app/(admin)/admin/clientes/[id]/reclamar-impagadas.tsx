"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Icono } from "@/components/ui/iconos";
import { desenvolver } from "@/lib/accion";
import { euros, fechaNumerica } from "@/lib/formato";
import { separarEmails } from "@/lib/reclamacion";
import { crearBorradorReclamacion } from "./acciones-reclamacion";

export type FacturaInsoluta = { id: number; numero: string; fecha: string; saldo: number; diasDesdeEmision: number; archivo: string };

type EstadoArchivo = "espera" | "preparando" | "listo" | "error";

type Props = {
  clienteId: number;
  razonSocial: string;
  insolutas: FacturaInsoluta[];
  totalAReclamar: number;
  archivoEstado: string;
  destinatarios: string[];
  asunto: string;
  cuerpo: string;
  /** Cuenta de Gmail conectada, o null. */
  gmail: string | null;
};

/**
 * Botón «Reclamar impagadas» y su ventana: prepara los PDF (estado de cuenta + facturas insolutas)
 * de uno en uno y crea con ellos un borrador en Gmail, listo para revisar y enviar.
 */
export function ReclamarImpagadas(p: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [para, setPara] = useState(p.destinatarios.join(", "));
  const [asunto, setAsunto] = useState(p.asunto);
  const [cuerpo, setCuerpo] = useState(p.cuerpo);
  const [estados, setEstados] = useState<Record<string, EstadoArchivo>>({});
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ url: string; remitente: string } | null>(null);

  const archivos: { clave: string; archivo: "estado" | number; nombre: string; detalle: string }[] = [
    { clave: "estado", archivo: "estado", nombre: `${p.archivoEstado}.pdf`, detalle: "Todas las facturas del cliente y el total insoluto" },
    ...p.insolutas.map((f) => ({
      clave: String(f.id),
      archivo: f.id,
      nombre: `${f.archivo}.pdf`,
      detalle: `${fechaNumerica(f.fecha)} · pendiente ${euros(f.saldo)} · emitida hace ${f.diasDesdeEmision} días`,
    })),
  ];

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && !trabajando && setAbierto(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto, trabajando]);

  function abrir() {
    setEstados({});
    setError(null);
    setHecho(null);
    setAbierto(true);
  }

  async function crear() {
    setError(null);
    const destinatarios = separarEmails(para);
    if (destinatarios.length === 0) {
      setError("Pon al menos un destinatario.");
      return;
    }
    setTrabajando(true);
    const lote = crypto.randomUUID();
    try {
      for (const a of archivos) {
        setEstados((e) => ({ ...e, [a.clave]: "preparando" }));
        const respuesta = await fetch(`/api/clientes/${p.clienteId}/reclamacion/pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lote, archivo: a.archivo }),
        });
        if (!respuesta.ok) {
          setEstados((e) => ({ ...e, [a.clave]: "error" }));
          const { error: motivo } = (await respuesta.json().catch(() => ({}))) as { error?: string };
          throw new Error(`No se ha podido preparar «${a.nombre}»: ${motivo ?? `HTTP ${respuesta.status}`}`);
        }
        setEstados((e) => ({ ...e, [a.clave]: "listo" }));
      }
      const resultado = await desenvolver(
        crearBorradorReclamacion(p.clienteId, lote, {
          para: destinatarios,
          asunto,
          cuerpo,
          documentos: p.insolutas.map((f) => f.id),
        }),
      );
      setHecho(resultado);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido crear el borrador.");
    } finally {
      setTrabajando(false);
    }
  }

  const listos = archivos.filter((a) => estados[a.clave] === "listo").length;

  return (
    <>
      <Boton variante="critico" onClick={abrir}>
        <Icono nombre="enviar" size={16} />
        Reclamar impagadas
      </Boton>

      {abierto && (
        <div
          className="fixed inset-0 z-[2500] flex items-end justify-center sm:items-center sm:p-esp4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-reclamar"
        >
          <button
            type="button"
            aria-label="Cerrar"
            className="animate-velo-entrar absolute inset-0 cursor-default bg-fondo-velo"
            onClick={() => !trabajando && setAbierto(false)}
          />
          <div className="animate-hoja-subir sm:animate-modal-entrar relative flex max-h-[92dvh] w-full flex-col gap-esp4 overflow-y-auto rounded-t-xl border border-borde-default bg-fondo-superficie p-esp5 shadow-elevado sm:max-w-2xl sm:rounded-xl">
            <div className="flex items-start gap-esp3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-texto-terciario">{p.razonSocial}</p>
                <h2 id="titulo-reclamar" className="text-lg font-semibold text-texto-primario">
                  Reclamar facturas impagadas
                </h2>
                <p className="tabular-nums text-sm text-texto-secundario">
                  {p.insolutas.length} factura{p.insolutas.length === 1 ? "" : "s"} insoluta
                  {p.insolutas.length === 1 ? "" : "s"} · total{" "}
                  <strong className="text-texto-critico">{euros(p.totalAReclamar)}</strong>
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                disabled={trabajando}
                onClick={() => setAbierto(false)}
                className="rounded-md p-esp1 text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press disabled:opacity-50"
              >
                <Icono nombre="cerrar" size={20} />
              </button>
            </div>

            {hecho ? (
              <div className="animate-estado-entrar flex flex-col gap-esp3 rounded-md border border-borde-exito bg-fondo-exito-sutil px-esp4 py-esp4" role="status">
                <p className="text-sm font-semibold text-texto-exito">Borrador creado en Gmail ({hecho.remitente})</p>
                <p className="text-sm text-texto-primario">
                  Ábrelo, revísalo y pulsa «Enviar» en Gmail. El estado de cuenta y las facturas ya van adjuntos.
                </p>
                <div className="flex flex-wrap gap-esp2">
                  <a
                    href={hecho.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-esp2 rounded-md bg-fondo-marca px-esp4 text-sm font-medium text-texto-sobre-marca hover:bg-fondo-marca-hover md:h-9"
                  >
                    <Icono nombre="enlace" size={16} />
                    Abrir borrador en Gmail
                  </a>
                  <Boton variante="secundario" onClick={() => setAbierto(false)}>
                    Cerrar
                  </Boton>
                </div>
              </div>
            ) : (
              <>
                {!p.gmail && (
                  <p className="rounded-md border border-borde-aviso bg-fondo-aviso-sutil px-esp3 py-esp2 text-sm text-texto-primario">
                    Para crear el borrador hay que conectar antes la cuenta de Gmail en{" "}
                    <Link href="/admin/ajustes/gmail" className="font-medium text-texto-marca hover:underline">
                      Ajustes → Gmail
                    </Link>
                    .
                  </p>
                )}

                <Campo
                  etiqueta="Para"
                  valor={para}
                  onCambio={setPara}
                  placeholder="administracion@cliente.es"
                  ayuda={
                    p.destinatarios.length
                      ? "Email de facturación y contactos que reciben las facturas. Separa varios con comas."
                      : "El cliente no tiene email de facturación: escríbelo aquí (y añádelo a su ficha)."
                  }
                />
                <Campo etiqueta="Asunto" valor={asunto} onCambio={setAsunto} />
                <div className="flex flex-col gap-esp1">
                  <label htmlFor="cuerpo-reclamacion" className="text-xs font-medium text-texto-secundario">
                    Mensaje
                  </label>
                  <textarea
                    id="cuerpo-reclamacion"
                    value={cuerpo}
                    onChange={(e) => setCuerpo(e.target.value)}
                    rows={12}
                    className="rounded-md border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-sm text-texto-primario outline-none focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20"
                  />
                  <p className="text-xs text-texto-terciario">Podrás cambiarlo también en Gmail antes de enviarlo.</p>
                </div>

                <div className="flex flex-col gap-esp2">
                  <div className="flex items-center justify-between gap-esp2">
                    <p className="text-xs font-medium text-texto-secundario">Adjuntos ({archivos.length})</p>
                    <Link
                      href={`/admin/clientes/${p.clienteId}/estado-cuenta`}
                      target="_blank"
                      className="text-xs font-medium text-texto-marca hover:underline"
                    >
                      Ver estado de cuenta
                    </Link>
                  </div>
                  <ul className="flex flex-col divide-y divide-borde-default rounded-md border border-borde-default">
                    {archivos.map((a) => {
                      const estado = estados[a.clave] ?? "espera";
                      return (
                        <li key={a.clave} className="flex items-center gap-esp3 px-esp3 py-esp2">
                          <Icono
                            nombre={estado === "listo" ? "check" : estado === "error" ? "alerta" : "documentos"}
                            size={16}
                            className={
                              estado === "listo"
                                ? "text-texto-exito"
                                : estado === "error"
                                  ? "text-texto-peligro"
                                  : estado === "preparando"
                                    ? "animate-pulse text-texto-marca"
                                    : "text-icono-default"
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-texto-primario">{a.nombre}</p>
                            <p className="truncate text-xs tabular-nums text-texto-terciario">{a.detalle}</p>
                          </div>
                          {estado === "preparando" && <span className="text-xs text-texto-marca">Preparando…</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {error && (
                  <p role="alert" className="text-sm text-texto-peligro">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-end gap-esp2">
                  <Boton variante="secundario" disabled={trabajando} onClick={() => setAbierto(false)}>
                    Cancelar
                  </Boton>
                  <Boton onClick={crear} disabled={trabajando || !p.gmail}>
                    <Icono nombre="enviar" size={16} />
                    {trabajando
                      ? listos < archivos.length
                        ? `Preparando PDF ${Math.min(listos + 1, archivos.length)}/${archivos.length}…`
                        : "Creando borrador…"
                      : "Crear borrador en Gmail"}
                  </Boton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
