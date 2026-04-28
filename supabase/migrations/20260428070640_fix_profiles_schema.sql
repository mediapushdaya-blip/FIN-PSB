-- Update profiles table to add missing fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Update handle_new_user to include default status and auto-admin for specific email
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, status)
  VALUES (
    new.id, 
    new.email, 
    CASE WHEN new.email = 'media.pushdaya@gmail.com' THEN 'admin' ELSE 'user' END,
    CASE WHEN new.email = 'media.pushdaya@gmail.com' THEN 'approved' ELSE 'pending' END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix existing profiles that might have 'staf' role or missing status
UPDATE public.profiles SET role = 'user' WHERE role = 'staf';
UPDATE public.profiles SET status = 'approved' WHERE status IS NULL;
UPDATE public.profiles SET status = 'approved' WHERE role = 'admin'; -- Ensure admins are approved
