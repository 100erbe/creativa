-- Quitar a una persona de un punto no debe fallar ni borrar las fotos de ese punto.
--
-- fotos_punto.asignacion_id apuntaba a asignaciones_punto sin regla de borrado, así que la base de datos
-- impedía quitar una asignación que ya tuviera fotos (el administrador veía el error técnico
-- «violates foreign key constraint fotos_punto_asignacion_id_fkey»).
-- Las fotos pertenecen al punto (fotos_punto.punto_id, que se mantiene): al quitar la asignación solo se
-- pierde la referencia a quién la tenía en ese momento.

alter table public.fotos_punto
  drop constraint fotos_punto_asignacion_id_fkey,
  add constraint fotos_punto_asignacion_id_fkey
    foreign key (asignacion_id) references public.asignaciones_punto (id) on delete set null;
