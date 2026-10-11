<script lang="ts">
  import type { WikiArticle } from '../../wiki/article';

  // Overview cards sit under a section h2; search result cards sit directly under the page h1.
  let { article, headingLevel }: { article: WikiArticle; headingLevel: 2 | 3 } = $props();
</script>

<a class="topic-card" href={`#${article.id}`}
  ><span class="card-category eyebrow">{article.category}</span><svelte:element
    this={`h${headingLevel}`}>{article.title} <span aria-hidden="true">↗</span></svelte:element
  >
  <p>{article.summary}</p></a
>

<style>
  .topic-card {
    display: block;
    padding: 1.5rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--card);
  }
</style>
