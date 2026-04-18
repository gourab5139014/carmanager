-- Security Hardening: Prevent IDOR via vehicle_id
-- Ensures a user can only link records to vehicles they own.

-- 1. Refuelings
DROP POLICY IF EXISTS "Users can manage their own refuelings" ON public.refuelings;
CREATE POLICY "Users can manage their own refuelings" ON public.refuelings
FOR ALL USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.vehicles 
    WHERE vehicles.id = vehicle_id 
    AND vehicles.user_id = auth.uid()
  )
);

-- 2. Services
DROP POLICY IF EXISTS "Users can manage their own services" ON public.services;
CREATE POLICY "Users can manage their own services" ON public.services
FOR ALL USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.vehicles 
    WHERE vehicles.id = vehicle_id 
    AND vehicles.user_id = auth.uid()
  )
);

-- 3. Expenses
DROP POLICY IF EXISTS "Users can manage their own expenses" ON public.expenses;
CREATE POLICY "Users can manage their own expenses" ON public.expenses
FOR ALL USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.vehicles 
    WHERE vehicles.id = vehicle_id 
    AND vehicles.user_id = auth.uid()
  )
);
