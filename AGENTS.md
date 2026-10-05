<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Use `CapaLivro` nas páginas que exibem livros; ela mostra a foto vinculada ou uma capa tipográfica com o título quando a foto não existe ou não carrega, evitando capas incorretas.

Cover discovery runs in an authenticated server function against free public catalogs; the browser persists only validated results through the existing private cover-storage flow, keeping external image URLs out of book records.
