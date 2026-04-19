-- 1. Create Schemas
CREATE SCHEMA IF NOT EXISTS legacy;
CREATE SCHEMA IF NOT EXISTS dev;

-- 2. Grant USAGE on schemas to Supabase roles
GRANT USAGE ON SCHEMA legacy TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA dev TO anon, authenticated, service_role;

-- 3. Move existing tables from public to legacy
-- This effectively "renames" public.refuelings to legacy.refuelings
ALTER TABLE public.refuelings SET SCHEMA legacy;
ALTER TABLE public.services SET SCHEMA legacy;
ALTER TABLE public.expenses SET SCHEMA legacy;
ALTER TABLE public.vehicles SET SCHEMA legacy;

-- 4. In the legacy schema, make vehicle_id nullable.
-- This ensures your legacy app (which doesn't know about vehicle_id) can still insert records.
ALTER TABLE legacy.refuelings ALTER COLUMN vehicle_id DROP NOT NULL;
ALTER TABLE legacy.services ALTER COLUMN vehicle_id DROP NOT NULL;
ALTER TABLE legacy.expenses ALTER COLUMN vehicle_id DROP NOT NULL;

-- 5. Clone legacy structure and data into dev for prototyping
-- We create new tables in dev schema by copying legacy ones.
CREATE TABLE dev.vehicles AS SELECT * FROM legacy.vehicles;
ALTER TABLE dev.vehicles ADD PRIMARY KEY (id);

CREATE TABLE dev.refuelings AS SELECT * FROM legacy.refuelings;
ALTER TABLE dev.refuelings ADD PRIMARY KEY (id);
ALTER TABLE dev.refuelings ADD CONSTRAINT refuelings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES dev.vehicles(id) ON DELETE CASCADE;

CREATE TABLE dev.services AS SELECT * FROM legacy.services;
ALTER TABLE dev.services ADD PRIMARY KEY (id);
ALTER TABLE dev.services ADD CONSTRAINT services_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES dev.vehicles(id) ON DELETE CASCADE;

CREATE TABLE dev.expenses AS SELECT * FROM legacy.expenses;
ALTER TABLE dev.expenses ADD PRIMARY KEY (id);
ALTER TABLE dev.expenses ADD CONSTRAINT expenses_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES dev.vehicles(id) ON DELETE CASCADE;

-- 6. Re-apply strict RLS to the dev tables
ALTER TABLE dev.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev.refuelings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own vehicles" ON dev.vehicles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own refuelings" ON dev.refuelings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own services" ON dev.services
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own expenses" ON dev.expenses
  FOR ALL USING (auth.uid() = user_id);

-- 7. Ensure legacy app roles can still access legacy schema
ALTER DEFAULT PRIVILEGES IN SCHEMA legacy GRANT ALL ON TABLES TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA legacy TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA legacy TO anon, authenticated, service_role;

-- Ensure dev app roles can access dev schema
ALTER DEFAULT PRIVILEGES IN SCHEMA dev GRANT ALL ON TABLES TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA dev TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA dev TO anon, authenticated, service_role;
