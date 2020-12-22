<script>
  import { Route } from 'tinro'

  import Index from './Index.svelte'
  import Form from './Form.svelte'
  import Search from './Search.svelte'

</script>
<header>
  <h1>hyper63 Search Demo</h1>
  <nav>
    <a href="/">Home</a> |
    <a href="/index">Create Index</a> |
    <a href="/new">Add Search Document</a> |
    <a href="/search">Run Search</a>
  </nav>
</header>
<Route path="/">
  <main>
    <h1>Search Demo</h1>
    <p>This is a simple demo of the hyper63 search module powered by mini-search</p>
    <p>In this demo you can create a search index, create search documents, perform a search</p>
    <p>Source: <a href="https://github.com/hyper63/search-demo">Source Code</a></p>
  </main>
</Route>
<Route path="/index">
  <Index />
</Route>
<Route path="/new">
  <Form />
</Route>
<Route path="/search">
  <Search />
</Route>


