-- 1. Security Hardening: Restrict execute on rls_auto_enable
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- 2. Performance: Optimize RLS policies using subquery for auth.uid()
-- Legacy Schema
DROP POLICY IF EXISTS "Users can manage their own vehicles" ON legacy.vehicles;
CREATE POLICY "Users can manage their own vehicles" ON legacy.vehicles
  FOR ALL USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own refuelings" ON legacy.refuelings;
CREATE POLICY "Users can manage their own refuelings" ON legacy.refuelings
  FOR ALL USING (
    (SELECT auth.uid()) = user_id 
    AND EXISTS (
      SELECT 1 FROM legacy.vehicles 
      WHERE vehicles.id = refuelings.vehicle_id 
      AND vehicles.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can manage their own services" ON legacy.services;
CREATE POLICY "Users can manage their own services" ON legacy.services
  FOR ALL USING (
    (SELECT auth.uid()) = user_id 
    AND EXISTS (
      SELECT 1 FROM legacy.vehicles 
      WHERE vehicles.id = services.vehicle_id 
      AND vehicles.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can manage their own expenses" ON legacy.expenses;
CREATE POLICY "Users can manage their own expenses" ON legacy.expenses
  FOR ALL USING (
    (SELECT auth.uid()) = user_id 
    AND EXISTS (
      SELECT 1 FROM legacy.vehicles 
      WHERE vehicles.id = expenses.vehicle_id 
      AND vehicles.user_id = (SELECT auth.uid())
    )
  );

-- Dev Schema
DROP POLICY IF EXISTS "Users can manage their own vehicles" ON dev.vehicles;
CREATE POLICY "Users can manage their own vehicles" ON dev.vehicles
  FOR ALL USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own refuelings" ON dev.refuelings;
CREATE POLICY "Users can manage their own refuelings" ON dev.refuelings
  FOR ALL USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own services" ON dev.services;
CREATE POLICY "Users can manage their own services" ON dev.services
  FOR ALL USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own expenses" ON dev.expenses;
CREATE POLICY "Users can manage their own expenses" ON dev.expenses
  FOR ALL USING ((SELECT auth.uid()) = user_id);


-- 3. Data Synchronization: Sync dev from legacy
-- We truncate dev tables and re-populate from legacy to resolve the 185 vs 182 row drift.
TRUNCATE dev.refuelings, dev.services, dev.expenses, dev.vehicles CASCADE;

INSERT INTO dev.vehicles SELECT * FROM legacy.vehicles;
INSERT INTO dev.refuelings SELECT * FROM legacy.refuelings;
INSERT INTO dev.services SELECT * FROM legacy.services;
INSERT INTO dev.expenses SELECT * FROM legacy.expenses;
