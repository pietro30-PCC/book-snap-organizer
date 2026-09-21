ALTER TABLE public.emprestimos
  ADD COLUMN IF NOT EXISTS data_prevista timestamp with time zone NOT NULL DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS observacao text;