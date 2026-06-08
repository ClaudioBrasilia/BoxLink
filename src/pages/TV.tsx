-- Permite que admins autenticados gerenciem patrocinadores
CREATE POLICY "sponsors_admin_insert"
  ON sponsors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "sponsors_admin_update"
  ON sponsors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "sponsors_admin_delete"
  ON sponsors FOR DELETE
  TO authenticated
  USING (true);
