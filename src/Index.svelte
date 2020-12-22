<script>
  import { index } from './dal.js'
  import { router } from 'tinro'

  let name = ''

  async function handleSubmit() {
    const result = await index(name)
    if (result.ok) {
      // navigate to home
      router.goto('/')
    }
  }
</script>
<main>
  <h1>Create Search Index Store</h1>
  <p>A search index store is like a database of search documents, this collection of search documents provides a way to specify a specific search you would like to perform.</p>
  <p>Complete the form to create a search index</p>
  <form on:submit|preventDefault={handleSubmit}>
    <div>
      <label for="name">Index Name</label>
      <input type="text" bind:value={name} id="name">
    </div>
    <div>
      <button type="submit">Create Index</button>
    </div>
  </form>
</main>

