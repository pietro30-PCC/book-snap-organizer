# Leitura gratuita, mais precisa, e limite maior de livros

## 1. Leitura sem gastar créditos (padrão)
Cada foto passa por etapas gratuitas, nesta ordem:
1. **Código de barras do livro (ISBN)**: o site procura o código de barras na foto, no próprio navegador. Funciona melhor com foto da contracapa.
2. **Busca gratuita pelo ISBN** em catálogos públicos de livros (Google Livros e Open Library): traz título, autor, categoria, descrição e às vezes a capa oficial. Essa é a forma mais precisa, porque os dados vêm do cadastro oficial do livro.
3. **Leitura do texto da capa no próprio navegador** (OCR gratuito) quando não houver código de barras: pega o texto maior (título) e procura o livro pelo nome nos mesmos catálogos públicos para completar autor e descrição.
4. Se nada funcionar, o livro fica como "precisa conferir" para a tia digitar.

## 2. IA só se você quiser
- Chave "Usar IA nos livros que não foram reconhecidos" — desligada por padrão. Quando ligada, só as fotos que falharam nas etapas gratuitas usam créditos.

## 3. Dica para mais precisão
- Aviso na tela: "Para melhor resultado, fotografe a contracapa com o código de barras visível."
- Fotos processadas com mais resolução (2048px) para o código de barras e o texto saírem nítidos.
- ISBN conferido pelo dígito verificador; se inválido, é descartado.

## 4. Limite maior
- De 300 para 1000 fotos por envio. As fotos continuam guardadas no navegador, então a tela segue leve.

## Observação
A leitura gratuita do texto da capa roda no computador da tia: é mais lenta e menos precisa que a IA em capas muito enfeitadas. Com código de barras, a precisão é quase total.

## Detalhes técnicos
- ISBN: `@zxing/browser` (já instalado) decodificando EAN-13 da imagem; validação checksum ISBN-10/13.
- Consulta: `googleapis.com/books/v1/volumes?q=isbn:` e fallback `openlibrary.org/isbn/…json` (sem chave), feita no navegador.
- OCR gratuito: `tesseract.js` (idioma por), em fila com 2 trabalhadores; busca por título `q=intitle:`.
- `lote.tsx`: pipeline novo por linha, `MAXIMO_ARQUIVOS = 1000`, `prepararFotoLeve(arquivo, 2048)`, chave opcional de IA chamando `lerCapaLivro` só nos falhos.
- Admin (cadastro individual) usa o mesmo pipeline.
