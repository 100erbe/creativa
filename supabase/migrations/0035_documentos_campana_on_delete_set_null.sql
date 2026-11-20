-- Permite eliminar una campaña aunque algún documento la referencie:
-- al borrar la campaña, documentos.campana_id pasa a NULL en lugar de bloquear el borrado.
ALTER TABLE documentos
  DROP CONSTRAINT IF EXISTS documentos_campana_fk,
  ADD CONSTRAINT documentos_campana_fk
    FOREIGN KEY (campana_id) REFERENCES campanas(id) ON DELETE SET NULL;
