# Creativa

App de gestión para una empresa de street marketing (vallas, tótems, lonas…).
Dos accesos: **admin** (presupuestos/facturas, libro contable, campañas) y
**empleado** (agenda con geolocalización, subida de fotos del trabajo
realizado, enlace para el cliente sin login).

Stack: **Next.js 15 (App Router) + Supabase (Postgres, Auth, Storage) +
Tailwind CSS**. Una sola app sirve tanto el panel de administración
(`/admin/*`) como la PWA del empleado (`/app/*`, instalable en el móvil).

## Primeros pasos

### 1. Instalar dependencias

```bash
npm install
```

### 2. Proyecto Supabase

Ya existe un proyecto real para esta app: **"Creativa - App"**
(`yltbnwhipqtrsufgsmyd`, región `eu-central-1`), con las 5 migraciones de
`supabase/migrations/` ya aplicadas (esquema completo + RLS). Para
desarrollar en local:

1. Copia `.env.example` a `.env.local` (o usa el `.env.local` ya presente,
   que **no** está en git) y rellena `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API del proyecto
   `yltbnwhipqtrsufgsmyd`, o pide las claves a quien lo administre).
2. Crea el primer usuario administrador:
   - Authentication → Users → **Add user** (email + contraseña).
   - En el SQL Editor: `insert into usuarios (id, nombre, apellidos, email, rol) values ('<uuid del usuario creado>', 'Tu nombre', 'Apellidos', 'tu@email.com', 'admin');`
3. Storage → crea un bucket **privado** llamado `fotos-puntos` (fotos del
   trabajo instalado). Falta añadir su política de subida para el rol
   empleado — ver nota en `supabase/LEEME.txt`.
4. Marca una serie como `por_defecto = true` para `tipo = 'presupuesto'`
   en la tabla `series` (la necesita el asistente de "Nuevo documento").

Si en cambio partes de cero con tu propio proyecto Supabase, aplica las
migraciones en orden desde el SQL Editor o con la CLI (`supabase db push`):
`0001_schema.sql` → `0002_schema_documentos.sql` → `0003_schema_campanas.sql`
→ `0004_mejoras_documentos.sql` → `0005_rls_y_seguridad.sql`.

### 3. Arrancar en local

```bash
npm run dev
```

- Panel de administración: `http://localhost:3000/admin/panel`
- App del empleado (PWA): `http://localhost:3000/app/agenda`
- Página pública del cliente: `http://localhost:3000/c/<token>`

## Estructura

```
src/
  app/
    (auth)/entrar/          página de acceso (admin + empleado comparten login)
    (admin)/admin/          panel, documentos, campañas, clientes, contabilidad
    (empleado)/app/         agenda, mapa, ficha de punto (foto + GPS)
    c/[token]/              página pública del cliente (sin login)
  components/
    ui/                     Botón, Campo, Insignia, Icono, Tarjeta KPI
    admin/                  Barra lateral
    empleado/               Barra inferior
  lib/supabase/             clientes de Supabase (browser/server) + middleware de roles
supabase/
  migrations/               el esquema completo de la base de datos
  LEEME.txt                 notas detalladas de cada módulo del esquema
```

## Diseño

Los colores, tipografía y espaciados de `tailwind.config.ts` reproducen
1:1 las variables creadas en el archivo de Figma del proyecto ("Creativa",
página "Sistema"). Si cambias un token en Figma, actualiza también
`tailwind.config.ts` para que no se desincronicen.

## Pendiente

- [ ] Conectar un proveedor de mapas real (Google Maps o Mapbox) en
      `/app/mapa` — de momento solo enlaza a Google Maps por punto.
- [ ] Política de Storage para que el empleado pueda subir a `fotos-puntos`.
- [ ] Mostrar las fotos en la página pública del cliente (`/c/[token]`):
      necesita un Route Handler con la `service_role` key o un bucket público
      aparte — ver el comentario en ese archivo.
- [ ] Paso 3 del asistente de documentos (revisar y emitir número definitivo).
- [ ] Pantallas de Clientes y Contabilidad (libro registro, ya existe la
      vista `v_libro_registro` en la base de datos).
- [x] ~~Generar `src/lib/supabase/types.ts` con `npx supabase gen types
      typescript`~~ — hecho: ya contiene los tipos reales del proyecto
      `yltbnwhipqtrsufgsmyd`. Si cambias el esquema, regenera con
      `npx supabase gen types typescript --project-id yltbnwhipqtrsufgsmyd > src/lib/supabase/types.ts`.
- [ ] `npm install` y arrancar `npm run dev` al menos una vez para comprobar
      que el proyecto compila (no se ha podido ejecutar en este entorno por
      falta de acceso a red para instalar paquetes).
