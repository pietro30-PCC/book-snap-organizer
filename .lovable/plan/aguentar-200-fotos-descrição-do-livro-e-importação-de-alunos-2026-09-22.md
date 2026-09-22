# Aguentar 200 fotos, descrição do livro e importação de alunos por Excel

Foco principal: o cadastro em lote não pode travar nem dar erro com muitas fotos (200 ou mais). Junto disso: descrição automática do livro, ficha rápida no catálogo e importação de alunos por planilha.

## 1. Cadastro em lote resistente a muitas fotos

Hoje a tela guarda todas as fotos abertas na memória e ainda salva um rascunho no navegador a cada digitação — com 200 fotos isso estoura a memória e o espaço do navegador, e a tela congela.

Mudanças:

- As fotos deixam de ficar todas na memória. Cada foto é reduzida e guardada num armazenamento local do navegador próprio para arquivos, e a lista mostra só miniaturas pequenas.
- Preparação das fotos em blocos (uma fila), com barra de progresso desde o momento em que os arquivos são escolhidos — nada de tela branca esperando 200 imagens.
- Limite de segurança: avisa quando passar de 300 arquivos por vez e sugere dividir, em vez de quebrar.
- Leitura automática (OCR) em fila com 3 por vez, com nova tentativa automática (até 3) quando o serviço responder "muitas leituras seguidas", com espera crescente. Botão "Pausar leitura" / "Continuar".
- Resumo fixo no topo: lidos, precisam conferir, repetidos, falharam — e botão "tentar de novo os que falharam".
- A lista longa passa a ser exibida em páginas (50 por vez) e os campos só atualizam a linha editada, para a digitação não ficar lenta.
- Rascunho guardado com atraso (não a cada tecla) e sem as imagens, evitando o erro de espaço cheio.
- Salvamento em blocos de 20 livros, com progresso ("salvando 40 de 200"), envio das capas em paralelo limitado, e recuperação: se um bloco falhar, os demais continuam e as linhas com erro permanecem na lista para nova tentativa.
- Etiquetas continuam iguais: depois de salvar, "Imprimir etiquetas destes livros" com a folha em grade.

## 2. Descrição do livro gerada automaticamente

- A leitura da capa passa a devolver também uma descrição curta (2 a 3 frases) sobre o livro, sem custo extra de leitura (vem na mesma leitura da foto).
- A descrição aparece na conferência do lote e pode ser editada antes de salvar.
- Nos livros já cadastrados, botão "Gerar descrição" na ficha, para preencher quem ainda não tem.

## 3. Ficha rápida no catálogo

- Clicar em um livro no catálogo abre uma janelinha com: capa maior, título, autor, categoria, código, ISBN, quantos exemplares existem e quantos estão disponíveis, a descrição e a data de entrada no acervo.
- Para quem está logado, a janelinha traz também "Imprimir etiqueta" e "Emprestar este livro".

## 4. Alunos: importar por planilha Excel

- Na tela de Alunos, nova seção "Importar lista da escola".
- Botão "Baixar modelo" gera uma planilha Excel com as colunas Nome, Turma e Matrícula e uma linha de exemplo.
- A tia envia a planilha preenchida (.xlsx ou .csv) e o site mostra uma lista de conferência: linhas válidas, linhas sem nome ou sem matrícula, e matrículas repetidas (na planilha ou já existentes).
- Ela corrige direto na tela, desmarca o que não quer e clica em "Importar os X alunos".
- Também continua o cadastro de um aluno por vez, e ganha busca por nome/turma/matrícula na lista.

## Detalhes técnicos

- Banco: nova coluna `descricao text` em `livros` (nullable), mantendo RLS e GRANTs atuais.
- Fotos do lote em IndexedDB (armazenamento por chave, sem biblioteca extra) com miniatura ~160px em memória; `dataUrl` completo lido sob demanda no momento do OCR e do upload, depois descartado. Limpeza do store ao salvar ou limpar a lista.
- `prepararFoto`: gerar também miniatura; processar arquivos em fila (concorrência 4) em vez de laço sequencial bloqueante.
- `ocr.server.ts`: incluir `descricao` no JSON pedido ao modelo e no tipo `LeituraCapa`.
- Nova camada de fila reutilizável (`src/lib/fila.ts`) com concorrência, pausa, cancelamento e retry exponencial para 429.
- `lote.tsx`: estado por linha com atualização imutável restrita, paginação da lista, salvamento em blocos via `criarLivrosEmLote`, `enviarCapa` com concorrência 4.
- Catálogo: `Dialog` do shadcn com os dados do livro; nova função `gerarDescricaoLivro` (server fn) e `atualizarLivro` em `biblioteca.ts`.
- Importação Excel: dependência `xlsx` (leitura e geração do modelo) no cliente; validação e dedupe antes de `criarAlunosEmLote`.
- Verificação no navegador com Playwright: lote com muitas imagens sintéticas (uso de memória, ausência de erros de quota), abertura da ficha no catálogo e importação de uma planilha de exemplo.
