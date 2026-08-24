# Sistema de gestão da biblioteca escolar — nova interface

Transformar o site atual (que parece um protótipo) em um sistema de gestão claro e agradável para a secretaria/bibliotecária usar todo dia, com visual institucional escolar (azul confiável, cartões limpos) e controle de prazos de devolução.

## 1. Nova identidade visual (institucional escolar)

- Paleta azul institucional: fundo claro #F5F8FC, azul principal #1D4ED8, apoio ciano #0EA5E9, texto grafite #0F172A, mais cores de estado (verde disponível, âmbar vence hoje, vermelho atrasado).
- Tipografia limpa e legível, sem serifa decorativa; hierarquia forte de títulos, rótulos e números.
- Cartões brancos com borda suave e sombra leve, cantos consistentes, muito mais respiro. Menos efeitos "brilho/aurora", mais clareza de sistema de gestão.
- Modo escuro coerente com a mesma paleta.

## 2. Estrutura de navegação (layout de sistema)

- Barra lateral fixa no desktop (Painel, Catálogo, Empréstimos, Alunos, Cadastrar livro) e barra inferior no celular.
- Cabeçalho com busca global (livro, código, aluno), nome da bibliotecária logada e botão sair.
- Cada tela com título, subtítulo explicativo e ação principal sempre visível.

## 3. Painel (nova tela inicial da gestão)

Cartões grandes com números do dia e atalhos:
- Livros no acervo / exemplares totais
- Emprestados agora
- Atrasados (destaque vermelho)
- Devoluções previstas para hoje
- Lista das últimas movimentações (saídas e entradas) com hora
- Ranking simples: livros mais emprestados e turmas que mais leem
- Botões grandes: "Registrar saída", "Registrar devolução", "Cadastrar livro"

## 4. Balcão de empréstimos (fluxo em 1 tela)

- Modo balcão: escanear o código (ou digitar) → o livro aparece grande com capa, disponibilidade e status.
- Escolha do aluno com busca por nome/turma/matrícula (em vez da lista suspensa atual).
- Prazo de devolução configurável: sugestão padrão de 14 dias com atalhos (7 / 14 / 30 dias) e escolha de data.
- Confirmação clara com resumo: aluno, livro, data de devolução.
- Devolução em um clique: escanear o livro devolvido e confirmar; se estiver atrasado, mostra quantos dias.
- Lista de empréstimos com abas: Ativos, Atrasados, Devolvidos; filtros por turma e busca; etiquetas coloridas de status.

## 5. Catálogo e busca

- Busca instantânea por título, autor, categoria ou código.
- Filtros por categoria e por disponibilidade, ordenação (recentes, A-Z, mais emprestados).
- Alternância entre grade de capas e lista compacta (melhor para consulta rápida no balcão).
- Ficha do livro: capa grande, dados, código de barras, exemplares disponíveis, histórico de quem pegou, botões "Emprestar" e "Imprimir etiqueta".

## 6. Cadastro de livros e alunos

- Cadastro de livro em passos claros: 1) foto da capa → 2) conferir dados lidos automaticamente → 3) quantidade e salvar → 4) imprimir etiqueta.
- Mensagens de progresso durante a leitura da foto e possibilidade de corrigir tudo à mão.
- Impressão de várias etiquetas de uma vez (folha com grade).
- Alunos: cadastro rápido, busca, filtro por turma, e visão do que cada aluno está com em mãos.

## 7. Facilidade de uso geral

- Confirmações antes de excluir, mensagens de erro em linguagem simples.
- Estados vazios que ensinam o próximo passo ("Nenhum livro ainda — cadastre o primeiro pela foto da capa").
- Carregamentos com esqueleto em vez de tela em branco; botões desabilitados durante o salvamento.
- Tudo responsivo para uso no celular no balcão.

## Detalhes técnicos

- Banco: adicionar `data_prevista` (timestamptz) em `emprestimos` e coluna opcional `observacao`; manter RLS atual (leitura pública, escrita só admin). Migração com GRANTs preservados.
- Consultas de painel: novas funções em `src/lib/biblioteca.ts` (contagens, atrasados, últimas movimentações, mais emprestados) usando o cliente do navegador com React Query.
- Novas rotas: `src/routes/_authenticated/painel.tsx` (dashboard) e `src/routes/_authenticated/livros.$id.tsx` (ficha do livro); rotas existentes reescritas para o novo layout.
- Novo componente de layout `LayoutGestao` (sidebar + topo) substituindo o uso direto de `NavBiblioteca` nas páginas internas; `NavBiblioteca` fica só no catálogo público.
- `src/styles.css`: nova paleta em oklch, tokens de status (`--status-ok`, `--status-warn`, `--status-late`), remoção dos utilitários exagerados (aurora/glow) em favor de sombras e bordas discretas.
- Componentes shadcn adicionais: Command (busca de aluno), Tabs, Dialog, Tooltip, Skeleton.
- Etiquetas em lote: nova visão de impressão reaproveitando `CodigoBarras`.
