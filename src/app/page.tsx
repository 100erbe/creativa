import { redirect } from "next/navigation";

// La raíz del sitio no tiene contenido propio: siempre redirige a la
// pantalla de acceso, que a su vez reparte a /admin o /app según el rol.
export default function Home() {
  redirect("/entrar");
}
