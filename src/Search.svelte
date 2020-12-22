<script>
  import { search } from './dal.js'

  let index = ''
  let question = ''
  let matches = []

  async function doSearch() {
    const result = await search(index, question)
    index = ''
    question = ''
    matches = result.matches
    console.log(matches)
  }

</script>
<main>
  <h1>Search</h1>
  <p>Perform a search using a search index you created and query text</p>
  <p>Select a search index to query then ask the search index a question</p>
  <form on:submit|preventDefault={doSearch}>
    <div>
      <label for="index">Index Name</label>
      <input id="index" type="text" bind:value={index}>
    </div>
    <div>
      <label for="question">Question</label>
      <input id="question" type="text" bind:value={question}>
    </div>
    <div>
      <button type="submit">Search</button>
    </div>
  </form>
  {#if matches}
    <h3>Search Results</h3>
    {#each matches as match}
      <article>
        <header>
          <h1>{match.Title}</h1>
        </header>
        <div>
          {match.Blob}
        </div>
        <div>
          <h4>Search Info</h4>
          <pre><code>{JSON.stringify(match, null, 2)}</code></pre>
        </div>
      </article>
    {/each}
  {/if}
</main>
<style>

  article {
    border: 1px solid gray;
    border-radius: var(--border-radius);
    padding: 1rem;
    margin: .25rem 0;
  }

  article header {
    margin: 0;
    padding: 0;
  }

  h1 {
    margin: 0;
    padding: 0;
  }
</style>
