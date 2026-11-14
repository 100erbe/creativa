-- "Verificado" lo decide el administrador. Las políticas RLS permiten al empleado asignado
-- actualizar su punto sin límite de estados, así que, además de que la app lo compruebe,
-- se blinda aquí: un empleado no puede poner un punto en "verificado" ni sacarlo de ese estado
-- (por ejemplo, al deshacer "marcar como instalado").
-- Solo afecta a usuarios autenticados que no son admin: el panel de admin y las
-- operaciones de mantenimiento (auth.uid() nulo) no se ven afectadas.

create or replace function public.proteger_punto_verificado()
returns trigger
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
begin
  if auth.uid() is not null and not public.es_admin() and new.estado is distinct from old.estado then
    if old.estado = 'verificado' then
      raise exception 'Un punto verificado por el administrador no se puede modificar.';
    end if;
    if new.estado = 'verificado' then
      raise exception 'Solo el administrador puede verificar un punto.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_punto_verificado on public.puntos_campana;
create trigger trg_proteger_punto_verificado
  before update of estado on public.puntos_campana
  for each row execute function public.proteger_punto_verificado();
