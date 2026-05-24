-- Add Ed25519 keypair columns to events for QR signing
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS public_key text,
  ADD COLUMN IF NOT EXISTS private_key text;

-- Add signature column to attendees (optional cached signed payload)
ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS signature text;

-- Public read of events.public_key only via a security-definer function
CREATE OR REPLACE FUNCTION public.get_event_public_key(_event_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public_key FROM public.events WHERE id = _event_id;
$$;