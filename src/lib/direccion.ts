/**
 * Compone la dirección postal sin repetir datos: en los clientes importados el campo
 * "direccion" ya suele incluir el código postal y el municipio ("Avda. X 2, 28026, Madrid").
 * Solo se añaden CP, municipio y provincia que no aparezcan ya en el texto.
 */
type DatosDireccion = {
  direccion?: string | null;
  codigoPostal?: string | null;
  municipio?: string | null;
  provincia?: string | null;
};

/**
 * Igual que `componerDireccion`, pero con la calle en una línea y el código postal
 * con la ciudad en otra, separadas por salto de línea (para el PDF).
 */
export function componerDireccionEnLineas(datos: DatosDireccion): string {
  const completa = componerDireccion(datos);
  // Primer código postal (5 dígitos) precedido por la calle: se corta ahí.
  const m = completa.match(/^(.*?)[\s,]+(\d{5}\b.*)$/);
  if (m && m[1] && m[2] && m[1].trim()) return `${m[1].trim()}\n${m[2].trim()}`;

  // Sin CP en el texto: la calle va sola y la ciudad (sin CP) en la segunda línea.
  const ciudad = [datos.municipio, datos.provincia].map((v) => (v ?? "").trim()).filter(Boolean);
  const calle = (datos.direccion ?? "").trim();
  const resto = ciudad.filter((v) => !calle.toLowerCase().includes(v.toLowerCase()));
  return [calle || null, resto.join(", ") || null].filter(Boolean).join("\n");
}

export function componerDireccion(datos: DatosDireccion): string {
  const base = (datos.direccion ?? "").trim();
  const minusculas = base.toLowerCase();
  const falta = (valor?: string | null) => {
    const v = (valor ?? "").trim();
    return v && !minusculas.includes(v.toLowerCase()) ? v : null;
  };

  const cp = falta(datos.codigoPostal);
  const municipio = falta(datos.municipio);
  const provincia = falta(datos.provincia);

  return [base || null, [cp, municipio].filter(Boolean).join(" ") || null, provincia]
    .filter(Boolean)
    .join(", ");
}
