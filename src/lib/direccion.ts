/**
 * Compone la dirección postal sin repetir datos: en los clientes importados el campo
 * "direccion" ya suele incluir el código postal y el municipio ("Avda. X 2, 28026, Madrid").
 * Solo se añaden CP, municipio y provincia que no aparezcan ya en el texto.
 */
export function componerDireccion(datos: {
  direccion?: string | null;
  codigoPostal?: string | null;
  municipio?: string | null;
  provincia?: string | null;
}): string {
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
