-- Guarda o caminho do arquivo da capa no Storage (ex.: livros/abc.jpg).
-- Com o álbum de capas privado, o site gera o link de exibição a partir deste caminho
-- sempre que lista os livros, assim a imagem nunca para de aparecer por link expirado.
alter table public.livros add column if not exists capa_arquivo text;

comment on column public.livros.capa_arquivo is 'Caminho do arquivo da capa no álbum capas; base para gerar links de exibição.';

-- Aproveita para registrar os arquivos das capas já cadastradas.
update public.livros
set capa_arquivo = split_part(split_part(capa_url, '/object/sign/capas/', 2), '?', 1)
where capa_url is not null
  and capa_url like '%/object/sign/capas/%'
  and capa_arquivo is null;
