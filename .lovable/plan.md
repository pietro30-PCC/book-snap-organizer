# Capas automáticas e apresentação com profundidade

## O que será feito
- Adicionar **Buscar capa** em cada livro do painel, usando ISBN primeiro e depois título, autor e descrição.
- Adicionar **Atualizar capas faltantes** para percorrer somente os livros sem foto, mostrar o progresso e informar encontrados/falhos.
- Consultar gratuitamente Google Livros e Open Library, sem inteligência artificial e sem consumir créditos.
- Copiar cada imagem encontrada para o álbum privado da biblioteca, evitando links externos que podem desaparecer.
- Manter a opção **Trocar foto** para a bibliotecária corrigir manualmente qualquer resultado.
- Aplicar profundidade visual com Tailwind: cartões com perspectiva, capa em relevo, sombras em camadas e movimentos suaves no catálogo e painel, respeitando a redução de movimento do aparelho.
- Continuar usando a capa tipográfica com o nome do livro quando nenhuma foto confiável for encontrada.

## Segurança e precisão
- A busca prioriza correspondência exata por ISBN.
- Sem ISBN, o resultado precisa combinar título e autor; resultados duvidosos não serão salvos automaticamente.
- Somente pessoas autenticadas poderão gravar ou trocar capas.

## Verificação
- Conferir busca individual e em lote, persistência da imagem e o fallback pelo título.
- Revisar catálogo e painel em tela grande e celular, incluindo os efeitos de profundidade.
- Confirmar compilação e ausência de erros na tela.

## Detalhes técnicos
- Função de servidor apenas para consultar catálogos e baixar a imagem pública com segurança.
- Upload reaproveita o fluxo existente do álbum `capas` e atualiza `capa_arquivo`/`capa_url`.
- Processamento em lote sequencial com intervalo curto para reduzir bloqueios dos catálogos gratuitos.
