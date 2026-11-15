-- 1. Tarea de retirada: una asignación con rol "retirador" (el instalador "instala", el retirador "quita").
--    El valor nuevo no se usa en esta migración, solo se declara.
alter type public.rol_asignacion add value if not exists 'retirador';

-- 2. El empleado asignado puede marcar como retirado un punto que el administrador ya había
--    verificado. Antes, cualquier cambio de estado desde "verificado" estaba prohibido, lo que
--    habría dejado la retirada de los puntos verificados bloqueada.
create or replace function public.proteger_punto_verificado()
returns trigger
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
begin
  if auth.uid() is not null and not public.es_admin() and new.estado is distinct from old.estado then
    if old.estado = 'verificado' and new.estado <> 'retirado' then
      raise exception 'Un punto verificado por el administrador no se puede modificar.';
    end if;
    if new.estado = 'verificado' then
      raise exception 'Solo el administrador puede verificar un punto.';
    end if;
  end if;
  return new;
end;
$$;

-- 3. Progreso de campaña: se cuentan los puntos retirados y, de paso, se corrige el recuento.
--    Antes `count(p.id)` se multiplicaba por el número de fotos de cada punto (el join con
--    fotos_punto repite la fila del punto), así que un punto con 2 fotos contaba como 2.
create or replace view public.v_progreso_campana as
select
    c.id as campana_id,
    c.nombre as campana,
    c.estado as estado_campana,
    cl.razon_social as cliente,
    count(distinct p.id) as puntos_totales,
    count(distinct p.id) filter (where p.estado = 'instalado')  as puntos_instalados,
    count(distinct p.id) filter (where p.estado = 'verificado') as puntos_verificados,
    count(distinct p.id) filter (where p.estado = 'incidencia') as puntos_con_incidencia,
    count(distinct p.id) filter (where p.estado = 'pendiente')  as puntos_pendientes,
    count(distinct f.id) as fotos_subidas,
    count(distinct p.id) filter (where p.estado = 'retirado')   as puntos_retirados
from public.campanas c
join public.clientes cl on cl.id = c.cliente_id
left join public.puntos_campana p on p.campana_id = c.id
left join public.fotos_punto f on f.punto_id = p.id
group by c.id, c.nombre, c.estado, cl.razon_social;

alter view public.v_progreso_campana set (security_invoker = on);
