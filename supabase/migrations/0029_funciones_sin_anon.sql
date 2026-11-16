-- =====================================================================
-- CREATIVA — Ninguna función de `public` se ejecuta sin sesión, salvo las de la
-- página pública del cliente (/c/[token]). Solo toca permisos: ningún dato.
--   1. Fuera EXECUTE de `anon` y de PUBLIC en todas las funciones de `public`.
--      `authenticated` y `service_role` conservan el permiso explícito que ya tenían.
--   2. Se mantienen para `anon` las tres RPC de la página pública
--      (obtener_campana_publica, obtener_fotos_publicas, registrar_vista_enlace).
--   3. es_admin() y es_usuario_activo() se evalúan dentro de políticas «to public»:
--      si `anon` no puede ejecutarlas, su consulta falla con «permission denied» en vez
--      de devolver 0 filas. Las dos devuelven false sin sesión, así que `anon` las
--      conserva (es_usuario_activo la recupera: 0024 se la quitó y 0028 la puso en
--      políticas «to public»).
--   4. Las funciones que se creen en adelante (por `postgres`) no nacen ejecutables
--      por `anon` ni por PUBLIC.
-- =====================================================================

-- 1. Todas las funciones de public: fuera PUBLIC y anon.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;

-- 2. Página pública del cliente (se llama sin sesión).
grant execute on function obtener_campana_publica(text) to anon, authenticated, service_role;
grant execute on function obtener_fotos_publicas(text)  to anon, authenticated, service_role;
grant execute on function registrar_vista_enlace(text)  to anon, authenticated, service_role;

-- 3. Funciones usadas dentro de las políticas RLS: sin sesión devuelven false.
grant execute on function es_admin()          to anon, authenticated, service_role;
grant execute on function es_usuario_activo() to anon, authenticated, service_role;

-- 4. Funciones futuras. El permiso de PUBLIC por defecto solo se quita de forma global
--    (no por esquema); los grants por esquema a authenticated y service_role se mantienen.
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;
