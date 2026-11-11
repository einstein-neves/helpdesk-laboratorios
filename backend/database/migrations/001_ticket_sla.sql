-- Compatível com instalações novas e existentes; não apaga chamados.
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS nivel_sla VARCHAR(2);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS prazo_sla TIMESTAMPTZ;
UPDATE public.tickets SET nivel_sla = CASE prioridade WHEN 'ALTA' THEN 'P2' WHEN 'BAIXA' THEN 'P4' ELSE 'P3' END WHERE nivel_sla IS NULL;
UPDATE public.tickets SET prazo_sla = data_abertura + CASE nivel_sla WHEN 'P1' THEN INTERVAL '4 hours' WHEN 'P2' THEN INTERVAL '8 hours' WHEN 'P4' THEN INTERVAL '72 hours' ELSE INTERVAL '24 hours' END WHERE prazo_sla IS NULL;
ALTER TABLE public.tickets ALTER COLUMN nivel_sla SET DEFAULT 'P3';
ALTER TABLE public.tickets ALTER COLUMN nivel_sla SET NOT NULL;
ALTER TABLE public.tickets ALTER COLUMN prazo_sla SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours');
ALTER TABLE public.tickets ALTER COLUMN prazo_sla SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_nivel_sla_check' AND conrelid = 'public.tickets'::regclass) THEN
  ALTER TABLE public.tickets ADD CONSTRAINT tickets_nivel_sla_check CHECK (nivel_sla IN ('P1','P2','P3','P4'));
 END IF;
END $$;
