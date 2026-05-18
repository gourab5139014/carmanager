-- Supabase Schema Template
-- Consolidated from migrations and base schema
-- 
-- Tables: vehicles, refuelings, services, expenses
-- Features: Multi-tenant (user_id), RLS, Optimized Policies, Performance Indexes

-- 1. Table Definitions

-- vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  make text,
  model text,
  year integer,
  active boolean DEFAULT true
);

-- refuelings table
CREATE TABLE IF NOT EXISTS refuelings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date date NOT NULL,
  odometer integer,
  volume_gal numeric(10,3),
  price_per_gal numeric(10,3),
  total_cost numeric(10,2),
  distance_mi numeric(10,1),
  full_tank boolean DEFAULT true,
  fuel_type text DEFAULT 'Gasoline',
  notes text
);

-- services table
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date date NOT NULL,
  odometer integer,
  description text,
  cost numeric(10,2),
  category text,
  notes text,
  location text
);

-- expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date date NOT NULL,
  odometer integer,
  description text,
  cost numeric(10,2),
  category text,
  notes text
);

-- 2. Constraints and Indexes

-- Unique constraint to prevent duplicate odometer entries per vehicle
ALTER TABLE refuelings ADD CONSTRAINT refuelings_vehicle_odometer_unique UNIQUE (vehicle_id, odometer);

-- Foreign key indexes for performance
CREATE INDEX IF NOT EXISTS idx_refuelings_vehicle_id ON refuelings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_refuelings_user_id    ON refuelings(user_id);
CREATE INDEX IF NOT EXISTS idx_services_vehicle_id   ON services(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_services_user_id      ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle_id   ON expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id      ON expenses(user_id);

-- 3. Row Level Security (RLS)

-- Enable RLS on all tables
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE refuelings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Standardized RLS policies using optimized subquery pattern
-- (SELECT auth.uid()) = user_id

-- Vehicles policy
CREATE POLICY "Users can manage their own vehicles" ON vehicles
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Refuelings policy (with vehicle ownership check)
CREATE POLICY "Users can manage their own refuelings" ON refuelings
  FOR ALL USING (
    (SELECT auth.uid()) = user_id 
    AND EXISTS (
      SELECT 1 FROM vehicles 
      WHERE vehicles.id = refuelings.vehicle_id 
      AND vehicles.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id 
    AND EXISTS (
      SELECT 1 FROM vehicles 
      WHERE vehicles.id = refuelings.vehicle_id 
      AND vehicles.user_id = (SELECT auth.uid())
    )
  );

-- Services policy (with vehicle ownership check)
CREATE POLICY "Users can manage their own services" ON services
  FOR ALL USING (
    (SELECT auth.uid()) = user_id 
    AND EXISTS (
      SELECT 1 FROM vehicles 
      WHERE vehicles.id = services.vehicle_id 
      AND vehicles.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id 
    AND EXISTS (
      SELECT 1 FROM vehicles 
      WHERE vehicles.id = services.vehicle_id 
      AND vehicles.user_id = (SELECT auth.uid())
    )
  );

-- Expenses policy (with vehicle ownership check)
CREATE POLICY "Users can manage their own expenses" ON expenses
  FOR ALL USING (
    (SELECT auth.uid()) = user_id 
    AND EXISTS (
      SELECT 1 FROM vehicles 
      WHERE vehicles.id = expenses.vehicle_id 
      AND vehicles.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id 
    AND EXISTS (
      SELECT 1 FROM vehicles 
      WHERE vehicles.id = expenses.vehicle_id 
      AND vehicles.user_id = (SELECT auth.uid())
    )
  );
