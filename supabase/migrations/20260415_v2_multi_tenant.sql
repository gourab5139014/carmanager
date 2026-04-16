-- Multi-Tenant v2 Schema Migration
-- Date: 2026-04-15

-- 1. Create vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  make text,
  model text,
  year integer,
  active boolean DEFAULT true
);

-- 2. Insert default vehicle for existing user
-- User ID: 5423b575-98f5-4522-acf4-4f3ff4f12f26 (gourab@carmanager.app)
INSERT INTO public.vehicles (user_id, name, make, model, year)
VALUES ('5423b575-98f5-4522-acf4-4f3ff4f12f26', 'Primary Lexus', 'Lexus', 'ES 350', 2010);

-- Get the ID of the new vehicle for linking
DO $$
DECLARE
    v_id uuid;
    u_id uuid := '5423b575-98f5-4522-acf4-4f3ff4f12f26';
BEGIN
    SELECT id INTO v_id FROM public.vehicles WHERE user_id = u_id LIMIT 1;

    -- 3. Update refuelings
    ALTER TABLE public.refuelings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE public.refuelings ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE;
    
    UPDATE public.refuelings SET user_id = u_id, vehicle_id = v_id WHERE user_id IS NULL;
    
    ALTER TABLE public.refuelings ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE public.refuelings ALTER COLUMN vehicle_id SET NOT NULL;
    ALTER TABLE public.refuelings ALTER COLUMN user_id SET DEFAULT auth.uid();

    -- 4. Update services
    ALTER TABLE public.services ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE public.services ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE;
    
    UPDATE public.services SET user_id = u_id, vehicle_id = v_id WHERE user_id IS NULL;
    
    ALTER TABLE public.services ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE public.services ALTER COLUMN vehicle_id SET NOT NULL;
    ALTER TABLE public.services ALTER COLUMN user_id SET DEFAULT auth.uid();

    -- 5. Update expenses
    ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE;
    
    UPDATE public.expenses SET user_id = u_id, vehicle_id = v_id WHERE user_id IS NULL;
    
    ALTER TABLE public.expenses ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE public.expenses ALTER COLUMN vehicle_id SET NOT NULL;
    ALTER TABLE public.expenses ALTER COLUMN user_id SET DEFAULT auth.uid();
END $$;

-- 6. Enable RLS on vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- 7. Reset and Secure Policies
-- Drop existing public policies
DROP POLICY IF EXISTS "public read" ON public.refuelings;
DROP POLICY IF EXISTS "auth insert" ON public.refuelings;
DROP POLICY IF EXISTS "public read" ON public.services;
DROP POLICY IF EXISTS "public read" ON public.expenses;

-- Create strict user-level policies
CREATE POLICY "Users can manage their own vehicles" ON public.vehicles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own refuelings" ON public.refuelings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own services" ON public.services
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own expenses" ON public.expenses
  FOR ALL USING (auth.uid() = user_id);

