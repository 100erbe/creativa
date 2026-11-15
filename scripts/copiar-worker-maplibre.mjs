// MapLibre GL 6 es solo ESM y su worker no se carga solo con el empaquetado de Next (falla con
// "Worker failed to load"). Se sirve como archivo estático desde /maplibre/ y la app le indica la ruta con
// setWorkerUrl (ver src/components/mapa/capa-base.tsx). Se copia desde node_modules en cada dev/build para
// que siempre coincida con la versión instalada y no haya que versionar archivos de terceros.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origen = join(raiz, "node_modules", "maplibre-gl", "dist");
const destino = join(raiz, "public", "maplibre");

if (!existsSync(origen)) {
  // Aún no instalado (p. ej. un `npm install` parcial): no se rompe la instalación; dev y build lo repiten.
  console.log("maplibre-gl no está instalado todavía: no se copia el worker.");
  process.exit(0);
}

mkdirSync(destino, { recursive: true });
// El worker importa el módulo compartido con una ruta relativa: tienen que ir juntos.
for (const archivo of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(origen, archivo), join(destino, archivo));
}
console.log("Worker de MapLibre copiado a public/maplibre/");
