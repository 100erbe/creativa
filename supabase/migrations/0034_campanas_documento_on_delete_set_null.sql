-- Permite eliminar documentos en borrador aunque una campaña los referencie:
-- al borrar el documento, campanas.documento_id pasa a NULL en lugar de bloquear el borrado.
ALTER TABLE campanas
  DROP CONSTRAINT IF EXISTS campanas_documento_id_fkey,
  ADD CONSTRAINT campanas_documento_id_fkey
    FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE SET NULL;
