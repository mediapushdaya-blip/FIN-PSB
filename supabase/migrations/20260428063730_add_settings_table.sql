-- Create settings table
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Active Row Level Security
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow reading settings for authenticated users
CREATE POLICY "Allow authenticated users to read settings" 
  ON public.settings FOR SELECT 
  TO authenticated
  USING (true);

-- Allow admins to write settings (for simplicity, we'll check if the role in profiles is admin)
CREATE POLICY "Allow admins to update settings" 
  ON public.settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Initialize default settings
INSERT INTO public.settings (key, value) VALUES 
('general', '{"name": "MY FINANCING", "logo": "", "favicon": ""}'),
('starting_balances', '{"balances": {}, "date": ""}')
ON CONFLICT (key) DO NOTHING;
