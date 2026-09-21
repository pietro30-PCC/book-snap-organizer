# Cadastro em lote, filtros e devolução fácil

Foco: a tia da biblioteca cadastrar muitos livros de uma vez (várias fotos juntas), encontrar livros rápido, emprestar e devolver com poucos cliques — mantendo as etiquetas com código de barras.

## 1. Cadastro de vários livros de uma vez

- Nova aba no painel: "Cadastrar em lote".
- A tia seleciona várias fotos de capa de uma vez (ou arrasta para a tela). Também aceita selecionar uma pasta inteira de fotos.
- O site lê as capas uma a uma, mostrando o progresso ("lendo 4 de 20") e sem travar a tela.
- Resultado: uma tabela de conferência, uma linha por foto, com miniatura da capa e os campos já preenchidos (título, autor, categoria, ISBN, quantidade), todos editáveis ali mesmo.
- Cada linha tem um selo de situação: lido com sucesso, precisa conferir (título vazio ou duvidoso), possível repetido (título/ISBN já existente no acervo) ou falhou (com botão "tentar de novo").
- Ações: marcar/desmarcar linhas, excluir linha, editar qualquer campo, "aplicar categoria a todos os selecionados".
- Só depois de conferir ela clica em "Salvar os X livros selecionados". Só nesse momento os livros entram no acervo — nada é salvo sem a conferência.
- Se ela fechar a página no meio, a conferência é retomada depois (rascunho guardado no próprio navegador).

## 2. Etiquetas (mantidas e melhoradas)

- Continua a etiqueta individual como hoje.
- Depois de salvar o lote, aparece direto "Imprimir etiquetas destes livros" — uma folha com grade de etiquetas (código de barras + título + autor), pronta para imprimir e recortar.
- No acervo, seleção de vários livros → "Imprimir etiquetas selecionadas".

## 3. Busca com filtros

- Na tela pública e no painel: busca por título, autor, categoria ou código, com filtros combináveis de categoria, disponibilidade (disponível / todo emprestado) e ordenação (recentes, A-Z, mais emprestados).
- Contador de resultados e botão "limpar filtros".

## 4. Emprestar e devolver fácil

- Balcão em uma tela: escanear a etiqueta (ou digitar o código) → o livro aparece grande → escolher o aluno por busca de nome/turma/matrícula (no lugar da lista suspensa atual) → confirmar.
- Prazo padrão de 14 dias, com atalhos 7/14/30 dias.
- Devolução em um clique: escanear a etiqueta do livro devolvido e o site já encontra o empréstimo aberto e pergunta só "confirmar devolução"; se estiver atrasado, mostra quantos dias.
- Lista de empréstimos com abas: Ativos, Atrasados, Devolvidos; filtro por turma e busca; botão "Devolver" em cada linha.

## 5. Alunos mais fáceis de gerenciar

- Busca por nome/matrícula e filtro por turma; lista agrupada por turma.
- Cadastro em lote: colar ou enviar uma lista (nome, turma, matrícula) e conferir antes de salvar, igual ao lote de livros.
- Ficha do aluno: livros que ele está com em mãos agora, atrasos e histórico; botão "Emprestar para este aluno".
- Confirmação antes de excluir e aviso claro quando a matrícula já existe.

## Detalhes técnicos

- Banco: adicionar `data_prevista` em `emprestimos` (padrão 14 dias) mantendo RLS e GRANTs atuais.
- OCR em lote: reaproveitar `lerCapaLivro` (`src/lib/ocr.functions.ts`) com fila de concorrência limitada (2–3 simultâneas) e novo tratamento de erro por item; upload das capas via `enviarCapa` só no momento de salvar.
- Nova rota `src/routes/_authenticated/lote.tsx` + componente de tabela de conferência; rascunho em `localStorage`.
- `src/lib/biblioteca.ts`: `criarLivrosEmLote`, detecção de duplicados por título/ISBN, `buscarEmprestimoAbertoPorLivro`, consultas por aluno.
- Etiquetas em folha: nova visão de impressão reaproveitando `CodigoBarras`/`EtiquetaLivro`.
- Busca de aluno com o componente Command (shadcn); abas com Tabs; skeletons nas listas.
