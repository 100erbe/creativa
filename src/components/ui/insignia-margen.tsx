import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { formatoPct, nivelMargen, type NivelMargen } from "@/lib/margen";

const TONO: Record<NivelMargen, TonoInsignia> = { bajo: "peligro", medio: "aviso", bueno: "exito" };

/** % de margen bruto con color (rojo < 20 %, ámbar 20–35 %, verde ≥ 35 %). Solo pantallas internas. */
export function InsigniaMargen({ pct, className }: { pct: number | null | undefined; className?: string }) {
  const nivel = nivelMargen(pct);
  if (nivel == null || pct == null) {
    return (
      <Insignia tono="neutro" className={className}>
        Sin coste
      </Insignia>
    );
  }
  return (
    <Insignia tono={TONO[nivel]} className={className}>
      {formatoPct(pct)}
    </Insignia>
  );
}
