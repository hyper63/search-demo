<script>
  import { add } from './dal.js'

  let index = ''

  let Title = ''
  let Blob = ''
  let url = ''

  async function handleSubmit() {
    const result = await add({
      index,
      id: new Date().toISOString(),
      Title,
      Blob,
      Attributes: {
        _source_uri: url
      }
    })
    // reset form
    if (result.ok) {
      Title = ''
      Blob = ''
      url = ''
    }

  }

</script>
<main>
  <h1>Create Search Document</h1>
  <p>This form creates a search document that can be used in the hyper63 search</p>
  <p>Complete the form to create a document to index</p>
  <form on:submit|preventDefault={handleSubmit}>
    <div>
      <label for="index">Index</label>
      <input type="text" id="index" bind:value={index}>
    </div>
    <div>
      <label for="title">Title</label>
      <input type="text" id="title" bind:value={Title}>
    </div>
    <div>
      <label for="content">Content</label>
      <textarea id="content" bind:value={Blob}></textarea>
    </div>
    <div>
      <label for="url">Bookmark</label>
      <input type="text" id="url" bind:value={url}>
    </div>
    <div>
      <button type="submit">Submit</button>
      <a href="/">Cancel and Close</a>
    </div>
  </form>
</main>
