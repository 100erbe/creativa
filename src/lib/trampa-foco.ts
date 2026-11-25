/**
 * Trampa de foco para diálogos, cajones y hojas modales (los de aria-modal), WCAG 2.4.3 / 2.1.2.
 *
 * Uso: `<div role="dialog" ... ref={atraparFoco}>`. Es un ref callback de React 19 (devuelve su
 * limpieza), estable porque es una función de módulo: no hace falta ningún hook.
 *  - Al abrirse lleva el foco dentro (al primer control, salvo que ya haya uno enfocado, p. ej. autoFocus).
 *  - Tab y Mayús+Tab dan la vuelta dentro del diálogo sin salir a la página de detrás.
 *  - Al cerrarse devuelve el foco al elemento que lo tenía antes (el botón que lo abrió).
 *  - Con diálogos anidados (una confirmación encima de un modal) solo manda el de arriba.
 */

const SELECTOR_ENFOCABLES = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Diálogos con trampa activa, el último es el de arriba. */
const pila: HTMLElement[] = [];

function enfocables(nodo: HTMLElement): HTMLElement[] {
  return Array.from(nodo.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES)).filter(
    (el) => el.getAttribute("aria-hidden") !== "true" && !el.closest("[inert]") && el.getClientRects().length > 0,
  );
}

function alTeclear(e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const nodo = pila[pila.length - 1];
  if (!nodo) return;
  const lista = enfocables(nodo);
  const activo = document.activeElement;
  if (lista.length === 0) {
    e.preventDefault();
    nodo.focus({ preventScroll: true });
    return;
  }
  const primero = lista[0]!;
  const ultimo = lista[lista.length - 1]!;
  const dentro = activo instanceof Node && nodo.contains(activo);
  if (e.shiftKey && (!dentro || activo === primero || activo === nodo)) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && (!dentro || activo === ultimo)) {
    e.preventDefault();
    primero.focus();
  }
}

export function atraparFoco(nodo: HTMLElement | null): (() => void) | undefined {
  if (!nodo) return undefined;
  const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (!nodo.hasAttribute("tabindex")) nodo.setAttribute("tabindex", "-1");

  pila.push(nodo);
  if (pila.length === 1) document.addEventListener("keydown", alTeclear, true);

  // Tras pintar: respeta un autoFocus de dentro; si no, el primer control (o el propio diálogo).
  const marco = requestAnimationFrame(() => {
    if (nodo.contains(document.activeElement)) return;
    (enfocables(nodo)[0] ?? nodo).focus({ preventScroll: true });
  });

  return () => {
    cancelAnimationFrame(marco);
    const i = pila.lastIndexOf(nodo);
    if (i >= 0) pila.splice(i, 1);
    if (pila.length === 0) document.removeEventListener("keydown", alTeclear, true);
    // Devuelve el foco solo si sigue en la página y nadie lo ha movido a otro sitio.
    const foco = document.activeElement;
    const focoPerdido = !foco || foco === document.body || nodo.contains(foco);
    if (anterior && anterior.isConnected && focoPerdido) anterior.focus({ preventScroll: true });
  };
}

/** Alias con nombre de hook, por coherencia con el resto del código: devuelve el ref callback. */
export function useFocusTrap() {
  return atraparFoco;
}
