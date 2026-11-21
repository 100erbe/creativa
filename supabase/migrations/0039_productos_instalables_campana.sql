-- Marca qué productos del catálogo son artículos físicamente instalables/repartibles
-- en puntos de campaña, excluyendo kilometraje, portes, comisiones y otros servicios.

alter table public.productos
  add column if not exists instalable_en_campana boolean not null default true;

comment on column public.productos.instalable_en_campana is
  'Indica si el artículo se instala o reparte en puntos de campaña (false para kilometraje, portes, comisiones y otros servicios).';

update public.productos p
set instalable_en_campana = false
from public.categorias c
where p.categoria_id = c.id
  and (
    c.codigo = 'SRV'
    or p.unidad_venta in ('km', 'servicio')
  );
