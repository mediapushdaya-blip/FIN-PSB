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

-- Re-apply admin for existing user just in case
UPDATE public.profiles 
SET role = 'admin', status = 'approved' 
WHERE email = 'media.pushdaya@gmail.com';
