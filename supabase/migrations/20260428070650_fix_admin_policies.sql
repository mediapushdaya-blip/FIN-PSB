-- Fix RLS Policies for Admin Access - Version 2 (Avoid Recursion)

-- SECURITY DEFINER function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by owners and admins" ON public.profiles;
DROP POLICY IF EXISTS "Profiles can be updated by owners and admins" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by owners and admins" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles can be updated by owners and admins" 
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());

-- 2. Transactions Policies
DROP POLICY IF EXISTS "Transactions viewable by owners and admins" ON public.transactions;
DROP POLICY IF EXISTS "Transactions updateable by owners and admins" ON public.transactions;
DROP POLICY IF EXISTS "Transactions deletable by owners and admins" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;

CREATE POLICY "Transactions viewable by owners and admins" 
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Transactions insertable by owners" 
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Transactions updatable by owners and admins" 
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Transactions deletable by owners and admins" 
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- 3. Settings Policies
DROP POLICY IF EXISTS "Allow admins to update settings" ON public.settings;
CREATE POLICY "Allow admins to update settings" 
  ON public.settings FOR ALL
  TO authenticated
  USING (public.is_admin());
