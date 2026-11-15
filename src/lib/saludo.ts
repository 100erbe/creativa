/** "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora en España. */
export function saludo(ahora: Date = new Date()) {
  const hora = Number(
    new Intl.DateTimeFormat("es-ES", { hour: "numeric", hour12: false, timeZone: "Europe/Madrid" }).format(ahora),
  );
  if (hora >= 6 && hora < 14) return "Buenos días";
  if (hora >= 14 && hora < 21) return "Buenas tardes";
  return "Buenas noches";
}
