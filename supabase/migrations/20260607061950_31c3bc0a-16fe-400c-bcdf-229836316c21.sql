CREATE TABLE public.gatekeeper_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Gatekeeper',
  created_by uuid NOT NULL,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gatekeeper_tokens TO authenticated;
GRANT ALL ON public.gatekeeper_tokens TO service_role;

ALTER TABLE public.gatekeeper_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage tokens for their events"
ON public.gatekeeper_tokens
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = gatekeeper_tokens.event_id AND e.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = gatekeeper_tokens.event_id AND e.user_id = auth.uid()));

CREATE INDEX gatekeeper_tokens_event_id_idx ON public.gatekeeper_tokens(event_id);