import Link from "next/link";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { Tarjeta, CabeceraTarjeta } from "@/components/ui/tarjeta";
import { Icono, type NombreIcono } from "@/components/ui/iconos";
import { clasesBoton } from "@/components/ui/boton";

// Ayuda: guías rápidas de las tareas habituales, atajos de teclado y a quién acudir.
// Contenido estático: si cambia un flujo de la app, actualizar aquí el paso correspondiente.

type Guia = {
  icono: NombreIcono;
  titulo: string;
  resumen: string;
  pasos: string[];
  href: string;
  enlace: string;
};

const GUIAS: Guia[] = [
  {
    icono: "documentos",
    titulo: "Crear un presupuesto o una factura",
    resumen: "El asistente «Nuevo documento» guarda un borrador a cada paso.",
    pasos: [
      "Pulsa «Nuevo documento» en Resumen o en Documentos.",
      "Elige el cliente (o créalo) y el tipo de documento.",
      "Vincula la campaña si el trabajo es de una campaña.",
      "Añade las líneas desde el catálogo; el precio se puede ajustar en cada línea.",
      "Revisa el borrador y pulsa «Emitir»: a partir de ahí tiene número definitivo.",
    ],
    href: "/admin/documentos/nuevo",
    enlace: "Nuevo documento",
  },
  {
    icono: "cobros",
    titulo: "Registrar un cobro",
    resumen: "Cada factura muestra su saldo pendiente y los cobros recibidos.",
    pasos: [
      "Abre la factura desde Documentos o desde Cobros.",
      "Pulsa «Registrar cobro» e indica el importe, la fecha y el método (transferencia, Bizum…).",
      "Si el cliente paga varias facturas a la vez, registra un cobro en cada una.",
      "La factura pasa a «Cobrada» cuando el saldo llega a cero.",
    ],
    href: "/admin/cobros",
    enlace: "Ir a Cobros",
  },
  {
    icono: "alerta",
    titulo: "Reclamar facturas impagadas",
    resumen: "Se prepara un estado de cuenta en PDF y un borrador de correo en Gmail.",
    pasos: [
      "En Cobros, «Clientes con más saldo» lleva al estado de cuenta de cada cliente.",
      "Revisa el estado de cuenta: una factura es insoluta con más de 90 días desde su emisión.",
      "En la ficha del cliente, pulsa «Reclamar impagadas»: se crea el borrador en Gmail con el estado de cuenta y las facturas adjuntas.",
      "Revisa el borrador en Gmail y envíalo desde allí.",
    ],
    href: "/admin/clientes?con_deuda=1",
    enlace: "Clientes con deuda",
  },
  {
    icono: "campanas",
    titulo: "Planificar una campaña",
    resumen: "Una campaña reúne los puntos (vallas, lonas, tótems…) y sus fotos.",
    pasos: [
      "Crea la campaña con su cliente y las fechas.",
      "Añade los puntos en el mapa y asígnalos al equipo.",
      "El equipo instala y sube las fotos desde su app; tú las verificas.",
      "Comparte con el cliente el enlace público de la campaña (no necesita cuenta).",
    ],
    href: "/admin/campanas/nueva",
    enlace: "Nueva campaña",
  },
  {
    icono: "clientes",
    titulo: "La app del equipo",
    resumen: "Los empleados entran con su cuenta y ven solo su trabajo.",
    pasos: [
      "Da de alta a cada persona en Ajustes › Equipo.",
      "En el móvil, abren la app y la añaden a la pantalla de inicio para recibir avisos.",
      "En Agenda y Mapa ven los puntos asignados; en cada punto suben la foto con su ubicación.",
      "También registran sus gastos, que tú apruebas en Gastos.",
    ],
    href: "/admin/ajustes/equipo",
    enlace: "Ajustes del equipo",
  },
  {
    icono: "gastos",
    titulo: "Revisar datos importados",
    resumen: "Los documentos de la importación pueden quedar marcados «Por revisar».",
    pasos: [
      "En Documentos, usa el filtro «Por revisar» o «Facturas sin vencimiento».",
      "Completa la fecha de vencimiento: sin ella, la antigüedad del saldo no es fiable.",
      "Pulsa «Marcar como revisado» cuando los datos sean correctos.",
    ],
    href: "/admin/documentos?revision=revisar",
    enlace: "Abrir la cola de revisión",
  },
];

const ATAJOS: { teclas: string[]; texto: string }[] = [
  { teclas: ["Ctrl", "K"], texto: "Buscar o ir a cualquier sección (⌘ K en Mac)" },
  { teclas: ["↑", "↓"], texto: "Moverse por los resultados de la búsqueda" },
  { teclas: ["Intro"], texto: "Abrir el resultado elegido" },
  { teclas: ["Esc"], texto: "Cerrar la búsqueda, un menú o un diálogo" },
  { teclas: ["←", "→"], texto: "Recorrer los intervalos de un gráfico del Resumen (con el gráfico enfocado)" },
];

export default function PaginaAyuda() {
  return (
    <div className="flex flex-col gap-esp5">
      <CabeceraPagina titulo="Ayuda" subtitulo="Guías rápidas de las tareas habituales y atajos de teclado." />

      <div className="grid grid-cols-1 gap-esp5 lg:grid-cols-2">
        {GUIAS.map((g) => (
          <Tarjeta key={g.titulo} como="section" aria-label={g.titulo}>
            <div className="flex items-start gap-esp4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-fondo-marca-sutil" aria-hidden="true">
                <Icono nombre={g.icono} size={20} className="text-icono-marca" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-titulo-panel text-texto-primario">{g.titulo}</h2>
                <p className="mt-esp1 text-meta font-medium text-texto-secundario">{g.resumen}</p>
              </div>
            </div>
            <ol className="flex flex-col gap-esp2">
              {g.pasos.map((p, i) => (
                <li key={i} className="flex gap-esp3 text-cuerpo text-texto-primario">
                  <span
                    className="tabular-nums flex h-6 w-6 shrink-0 items-center justify-center rounded-completo bg-fondo-sutil text-etiqueta text-texto-secundario"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">{p}</span>
                </li>
              ))}
            </ol>
            <Link href={g.href} className={clasesBoton("secundario", "m", "self-start")}>
              {g.enlace}
            </Link>
          </Tarjeta>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-esp5 lg:grid-cols-2">
        <Tarjeta como="section" aria-labelledby="titulo-atajos">
          <CabeceraTarjeta id="titulo-atajos" titulo="Atajos de teclado" />
          <dl className="flex flex-col divide-y divide-borde-default">
            {ATAJOS.map((a) => (
              <div key={a.texto} className="flex items-center gap-esp4 py-esp3">
                <dt className="flex shrink-0 gap-esp1">
                  {a.teclas.map((t) => (
                    <kbd
                      key={t}
                      className="min-w-8 rounded-md border border-borde-default bg-fondo-sutil px-esp2 py-0.5 text-center font-sans text-etiqueta text-texto-primario"
                    >
                      {t}
                    </kbd>
                  ))}
                </dt>
                <dd className="text-cuerpo text-texto-secundario">{a.texto}</dd>
              </div>
            ))}
          </dl>
        </Tarjeta>

        <Tarjeta como="section" aria-labelledby="titulo-contacto">
          <CabeceraTarjeta id="titulo-contacto" titulo="¿Algo no funciona?" />
          <p className="text-cuerpo text-texto-secundario">
            Si una cifra no cuadra o una pantalla da error, anota qué estabas haciendo (página, documento o cliente) y
            avisa a quien administra la aplicación. Las dudas sobre los datos importados se recogen en el documento
            de dudas de la base de datos.
          </p>
          <div className="flex flex-wrap gap-esp3">
            <Link href="/admin/ajustes" className={clasesBoton("secundario")}>
              Ir a Ajustes
            </Link>
            <Link href="/admin/avisos/nuevo" className={clasesBoton("secundario")}>
              Enviar un aviso al equipo
            </Link>
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}
