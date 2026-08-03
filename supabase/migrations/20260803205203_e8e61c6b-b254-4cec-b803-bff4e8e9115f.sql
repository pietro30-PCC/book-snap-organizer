
CREATE SEQUENCE IF NOT EXISTS public.livro_codigo_seq START 1;

CREATE TABLE public.livros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE DEFAULT ('BIB-' || lpad(nextval('public.livro_codigo_seq')::text, 6, '0')),
  titulo text NOT NULL,
  autor text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT '',
  isbn text,
  quantidade integer NOT NULL DEFAULT 1,
  disponiveis integer NOT NULL DEFAULT 1,
  capa_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  turma text NOT NULL DEFAULT '',
  matricula text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.emprestimos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  livro_id uuid NOT NULL REFERENCES public.livros(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  data_emprestimo timestamptz NOT NULL DEFAULT now(),
  data_devolucao timestamptz
);

CREATE INDEX ON public.emprestimos (livro_id);
CREATE INDEX ON public.emprestimos (aluno_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.livros TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alunos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emprestimos TO anon, authenticated;
GRANT ALL ON public.livros TO service_role;
GRANT ALL ON public.alunos TO service_role;
GRANT ALL ON public.emprestimos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.livro_codigo_seq TO anon, authenticated, service_role;

ALTER TABLE public.livros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emprestimos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso publico livros" ON public.livros FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acesso publico alunos" ON public.alunos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acesso publico emprestimos" ON public.emprestimos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
