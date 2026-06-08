ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS ticket_types text[] NOT NULL DEFAULT ARRAY['General']::text[];