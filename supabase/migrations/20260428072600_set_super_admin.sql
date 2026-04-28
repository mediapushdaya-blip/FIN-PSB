-- Ensure our super admin exists with the correct role and status
-- This assumes the user has already signed up via Supabase Auth
UPDATE public.profiles 
SET role = 'admin', status = 'approved' 
WHERE email = 'media.pushdaya@gmail.com';

-- Grant bypass RLS for admin checks if needed, though our is_admin() function handles it
