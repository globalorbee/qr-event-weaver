ALTER TABLE public.attendees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'other';
CREATE INDEX IF NOT EXISTS idx_attendees_event_id ON public.attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_status ON public.attendees(status);