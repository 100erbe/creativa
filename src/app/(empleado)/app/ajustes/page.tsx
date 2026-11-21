import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { PanelAvisos } from "@/components/avisos/panel-avisos";
import { PanelFotosOffline } from "@/components/empleado/panel-fotos-offline";
import { Tarjeta, CabeceraTarjeta } from "@/components/ui/tarjeta";
import { Icono, type NombreIcono } from "@/components/ui/iconos";

export const dynamic = "force-dynamic";

type AyudaItem = {
  titulo: string;
  icono: NombreIcono;
  pasos: string[];
};

const AYUDA_RAPIDA: AyudaItem[] = [
  {
    titulo: "Instalar Creativa en la pantalla de inicio",
    icono: "avisos",
    pasos: [
      "En iPhone: abre Creativa en Safari, pulsa Compartir y elige «Añadir a pantalla de inicio».",
      "En Android: abre el menú de Chrome (⋮) y pulsa «Instalar aplicación» o «Añadir a pantalla de inicio».",
      "Abre siempre la app desde el icono nuevo para recibir avisos y trabajar a pantalla completa.",
    ],
  },
  {
    titulo: "Subir fotos en zonas sin cobertura",
    icono: "camara",
    pasos: [
      "Haz la foto del punto con normalidad: si no hay red, se guarda comprimida en el teléfono.",
      "Verás un aviso arriba mientras queden fotos pendientes y se enviarán solas al recuperar señal.",
      "También puedes comprobar el estado o forzar el envío desde «Fotos sin conexión» en esta pantalla.",
    ],
  },
  {
    titulo: "Si no funciona el GPS o la cámara",
    icono: "ubicacion",
    pasos: [
      "Comprueba en los ajustes del móvil que el navegador (Safari o Chrome) tiene permiso de Ubicación y Cámara.",
      "Si rechazaste el permiso antes, vuelve a activarlo para este sitio en la barra de dirección y recarga la página.",
      "En interiores o garajes, espera unos segundos en el exterior para que el GPS fije tu posición.",
    ],
  },
  {
    titulo: "Registrar y corregir gastos menores",
    icono: "gastos",
    pasos: [
      "Pulsa «Añadir gasto menor» desde el menú o «Nuevo gasto» en Mis gastos y haz foto al ticket.",
      "Si administración rechaza un gasto, verás el motivo y un indicador en rojo en la barra inferior.",
      "Ábrelo para corregirlo y volver a enviarlo sin perder el ticket.",
    ],
  },
];

export default async function PaginaAjustesEmpleado() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "empleado") redirect("/entrar?volver=/app/ajustes");

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <div>
        <h1 className="text-2xl font-bold text-texto-primario">Ajustes</h1>
        <p className="text-cuerpo text-texto-secundario">
          Notificaciones, estado de este dispositivo y ayuda rápida.
        </p>
      </div>

      <PanelAvisos />

      <PanelFotosOffline />

      <Tarjeta como="section" aria-labelledby="titulo-cuenta-ajustes">
        <CabeceraTarjeta
          id="titulo-cuenta-ajustes"
          titulo="Cuenta y seguridad"
          descripcion="Tus datos personales, foto de perfil, contraseña y sesiones abiertas."
        />
        <div className="flex flex-col divide-y divide-borde-default">
          <Link
            href="/app/cuenta"
            className="group flex min-h-12 items-center gap-esp3 py-esp3 text-left transition-colors duration-rapida ease-suave hover:text-texto-marca"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fondo-marca-sutil">
              <Icono nombre="clientes" size={18} className="text-icono-marca" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-texto-primario group-hover:text-texto-marca">
                Mi cuenta
              </span>
              <span className="block text-xs text-texto-secundario">
                Nombre, teléfono, foto de perfil y cerrar sesiones en otros dispositivos
              </span>
            </span>
            <Icono nombre="chevron" size={18} className="text-icono-default transition-transform duration-rapida group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/cuenta/contrasena"
            className="group flex min-h-12 items-center gap-esp3 py-esp3 text-left transition-colors duration-rapida ease-suave hover:text-texto-marca"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fondo-marca-sutil">
              <Icono nombre="candado" size={18} className="text-icono-marca" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-texto-primario group-hover:text-texto-marca">
                Cambiar contraseña
              </span>
              <span className="block text-xs text-texto-secundario">
                Actualiza la clave con la que entras en Creativa
              </span>
            </span>
            <Icono nombre="chevron" size={18} className="text-icono-default transition-transform duration-rapida group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Tarjeta>

      <Tarjeta como="section" aria-labelledby="titulo-ayuda-empleado">
        <CabeceraTarjeta
          id="titulo-ayuda-empleado"
          titulo="Ayuda rápida"
          descripcion="Guías breves para el día a día en el campo."
        />
        <div className="flex flex-col divide-y divide-borde-default">
          {AYUDA_RAPIDA.map((item) => (
            <details key={item.titulo} className="group py-esp3 first:pt-0 last:pb-0">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-esp3 text-sm font-semibold text-texto-primario transition-colors duration-rapida ease-suave hover:text-texto-marca [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fondo-sutil">
                  <Icono nombre={item.icono} size={16} className="text-icono-marca" />
                </span>
                <span className="min-w-0 flex-1">{item.titulo}</span>
                <Icono
                  nombre="chevron"
                  size={18}
                  className="text-icono-default transition-transform duration-rapida ease-salida group-open:rotate-90"
                />
              </summary>
              <ol className="mt-esp3 flex flex-col gap-esp2 pl-11">
                {item.pasos.map((paso, i) => (
                  <li key={i} className="flex gap-esp2 text-cuerpo text-texto-secundario">
                    <span
                      aria-hidden="true"
                      className="tabular-nums mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-completo bg-fondo-sutil text-micro font-semibold text-texto-secundario"
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">{paso}</span>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}
