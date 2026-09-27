# Leitura mais precisa e limite maior de livros no lote

## 1. Leitura das capas mais precisa
- Fotos enviadas para a leitura com mais resolução e qualidade (hoje são reduzidas para 1280px; passam para 2048px com qualidade maior), para letras pequenas e ISBN saírem melhores.
- Troca para um modelo de IA mais forte na leitura (Gemini Pro), com instrução mais rigorosa: copiar o título exatamente como está na capa, respeitar acentos, não confundir editora/coleção com autor, e ISBN só com 10 ou 13 dígitos válidos.
- Conferência automática do ISBN (dígito verificador). Se estiver inválido, é apagado e o livro vai para "precisa conferir".
- A leitura devolve também um nível de confiança; livros com leitura duvidosa ficam marcados como "precisa conferir".
- Se a primeira leitura vier sem título, o sistema tenta uma segunda vez automaticamente.

## 2. Limite maior de livros por vez
- O limite passa de 300 para 1000 fotos por envio.
- Como as fotos já ficam guardadas no navegador (não na memória), a tela continua leve; o aviso de "divida em partes" só aparece acima de 1000.
- A leitura continua de 3 em 3 para não esbarrar no limite do serviço de IA (com mais livros, o tempo total aumenta proporcionalmente).

## Observação
O modelo mais forte é mais lento e gasta mais créditos de IA por foto. Com 1000 fotos, o consumo será bem maior que hoje.

## Detalhes técnicos
- `ocr.server.ts`: modelo `google/gemini-2.5-pro`; prompt reforçado; campo `confianca` (alta/media/baixa); validação de checksum ISBN-10/13.
- `lote.tsx`: `MAXIMO_ARQUIVOS = 1000`; `prepararFotoLeve(arquivo, 2048)` com JPEG 0.9; marcar "conferir" quando confiança baixa ou ISBN inválido; nova tentativa se título vazio.
- `imagem.ts`: parâmetro de qualidade configurável.
- Limite do tamanho da imagem no servidor (9 MB) mantido — suficiente para 2048px.
