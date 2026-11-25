import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pruebas de los módulos puros (cálculos fiscales, cobros, vencimientos, CSV…): sin navegador
// ni base de datos. `npm test` las ejecuta una vez; `npx vitest` las deja vigilando cambios.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
