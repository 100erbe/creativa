"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { cn } from "@/lib/cn";
import { desenvolver } from "@/lib/accion";
import { ETIQUETA_SOPORTE } from "@/lib/etiquetas";
import { guardarPunto } from "./acciones";
import { useAnadirPunto } from "./anadir-punto";

export type PuntoEditable = {
  id: number;
  linea_id: number | null;
  nombre: string;
  tipo_soporte: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  piezas: number | null;
  fecha_colocacion_prevista: string | null;
  fecha_retirada_prevista: string | null;
  notas: string | null;
};


const area =
  "rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm";

/**
 * Alta o edición de un punto de la campaña, desde la propia ficha de la campaña
 * (no hace falta que exista un documento en borrador).
 */
const formatoPiezas = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

/** Artículo de un documento de la campaña, con las piezas ya repartidas entre sus puntos. */
export type ArticuloPunto = {
  id: number;
  etiqueta: string;
  documento: string;
  piezas: number;
  repartidas: number;
};

export function FormularioPunto() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // La posición vive en el mapa de la campaña (compartida con el formulario).
  const { modo, posicion, direccionSugerida, cerrar: onCerrar, datos } = useAnadirPunto();
  const { campanaId, articulos, fechasCampana } = datos;
  const punto = modo?.tipo === "editar" ? modo.punto : undefined;

  const [tipo, setTipo] = useState(punto?.tipo_soporte ?? "cartel");
  const [lineaId, setLineaId] = useState<number | null>(
    punto?.linea_id ?? (articulos.length === 1 ? articulos[0]!.id : null),
  );
  const [direccion, setDireccion] = useState(punto?.direccion ?? "");
  const [piezas, setPiezas] = useState(punto?.piezas != null ? String(punto.piezas).replace(".", ",") : "");
  const [colocacion, setColocacion] = useState(punto ? (punto.fecha_colocacion_prevista ?? "") : (fechasCampana.inicio ?? ""));
  const [retirada, setRetirada] = useState(punto ? (punto.fecha_retirada_prevista ?? "") : (fechasCampana.fin ?? ""));
  const [instrucciones, setInstrucciones] = useState(punto?.notas ?? "");

  // Al mover el punto en el mapa (o elegir una búsqueda) se propone la nueva dirección.
  useEffect(() => {
    if (direccionSugerida) setDireccion(direccionSugerida.texto);
  }, [direccionSugerida]);
  useEffect(() => {
    if (posicion) setError(null);
  }, [posicion]);

  // Contador de piezas del artículo elegido: lo ya repartido en otros puntos + lo que se escribe aquí.
  const articuloElegido = articulos.find((a) => a.id === lineaId) ?? null;
  const propias = punto && punto.linea_id === lineaId ? (punto.piezas ?? 0) : 0;
  const estas = Number(piezas.replace(",", ".")) || 0;
  const restantes = articuloElegido ? articuloElegido.piezas - (articuloElegido.repartidas - propias) - estas : 0;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!posicion) return setError("Primero marca la ubicación en el mapa o busca la dirección.");
    if (articulos.length > 0 && lineaId == null) return setError("Elige a qué artículo del presupuesto o de la factura corresponde el punto.");
    const nPiezas = piezas.trim() === "" ? null : Number(piezas.replace(",", "."));
    iniciar(async () => {
      try {
        await desenvolver(
          guardarPunto(campanaId, punto?.id ?? null, {
            tipoSoporte: tipo,
            lineaId,
            direccion,
            latitud: posicion.latitud,
            longitud: posicion.longitud,
            piezas: nPiezas,
            fechaColocacion: colocacion,
            fechaRetirada: retirada,
            instrucciones,
          }),
        );
        router.refresh();
        onCerrar();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar el punto.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-borde-foco bg-fondo-superficie p-esp4">
      <form onSubmit={guardar} className="flex flex-col gap-esp3">
        <h3 className="text-base font-semibold text-texto-primario">{punto ? `Editar ${/^\d+$/.test(punto.nombre.trim()) ? `Punto ${punto.nombre.trim()}` : punto.nombre}` : "Nuevo punto"}</h3>
        <p className={cn("text-xs", posicion ? "text-texto-exito" : "text-texto-terciario")}>
          {posicion
            ? `Ubicación: ${posicion.latitud.toFixed(5)}, ${posicion.longitud.toFixed(5)}`
            : "Sin ubicación: márcala en el mapa o busca la dirección."}
        </p>
        {articulos.length > 0 ? (
          <>
            <Campo texto="Artículo *">
              <select
                value={lineaId ?? ""}
                onChange={(e) => setLineaId(e.target.value ? Number(e.target.value) : null)}
                className={CAMPO}
              >
                <option value="">Elige un artículo…</option>
                {articulos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo texto="Piezas de este punto">
              <input value={piezas} onChange={(e) => setPiezas(e.target.value)} inputMode="decimal" className={CAMPO} />
              {articuloElegido && (
                <span className={restantes < 0 ? "text-xs text-texto-aviso" : "text-xs text-texto-terciario"} role="status">
                  {restantes < 0
                    ? `Con este punto te pasas ${formatoPiezas(-restantes)} del total (${formatoPiezas(articuloElegido.piezas)}). Puedes guardarlo igualmente.`
                    : restantes === 0
                      ? `Con este punto se reparte todo el artículo (${formatoPiezas(articuloElegido.piezas)}).`
                      : `Quedan ${formatoPiezas(restantes)} de ${formatoPiezas(articuloElegido.piezas)}`}
                </span>
              )}
            </Campo>
          </>
        ) : (
          <>
            <p className="rounded-md bg-fondo-aviso-sutil px-esp3 py-esp2 text-xs text-texto-primario">
              Esta campaña no tiene presupuesto ni factura vinculados. Vincula uno desde el documento para elegir entre
              sus artículos; mientras, indica el soporte a mano.
            </p>
            <div className="grid grid-cols-2 gap-esp3">
              <Campo texto="Soporte">
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO}>
                  {Object.entries(ETIQUETA_SOPORTE).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo texto="Piezas">
                <input value={piezas} onChange={(e) => setPiezas(e.target.value)} inputMode="decimal" className={CAMPO} />
              </Campo>
            </div>
          </>
        )}
        <Campo texto="Dirección">
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={CAMPO} />
        </Campo>
        <div className="grid grid-cols-2 gap-esp3">
          <Campo texto="Colocar el">
            <input type="date" value={colocacion} onChange={(e) => setColocacion(e.target.value)} className={CAMPO} />
          </Campo>
          <Campo texto="Retirar el">
            <input
              type="date"
              value={retirada}
              min={colocacion || undefined}
              onChange={(e) => setRetirada(e.target.value)}
              className={CAMPO}
            />
          </Campo>
        </div>
        <Campo texto="Cómo instalar (lo verá el instalador)">
          <textarea
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            rows={3}
            placeholder="Ej. 2 carteles 70x100 con bridas, cara hacia la rotonda"
            className={area}
          />
        </Campo>
        {error && <p className="text-xs text-texto-peligro">{error}</p>}
        <div className="flex gap-esp2">
          <Boton type="submit" className="min-h-11 flex-1" cargando={pendiente}>
            {punto ? "Guardar cambios" : "Añadir punto"}
          </Boton>
          <Boton type="button" variante="secundario" className="min-h-11" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Boton>
        </div>
      </form>
    </div>
  );
}

function Campo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-texto-secundario">{texto}</span>
      {children}
    </label>
  );
}
