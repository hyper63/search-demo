import Async from 'crocks/Async'

const url = 'https://hyper63-minisearch.onrender.com'

const asyncFetch = Async.fromPromise(fetch)
const toJSON = res => Async.fromPromise(res.json.bind(res))()


export const index = (name) => asyncFetch(`${url}/search/${name}`, { 
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fields: ["Title", "Blob"],
    storeFields: ["Title", "Blob", "Attributes"]
  })
}).chain(toJSON)
  .toPromise()

export const add = ({index, id, Title, Blob, Attributes}) => asyncFetch(`${url}/search/${index}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    key: id,
    doc: { id, Title, Blob, Attributes }
  })
}).chain(toJSON)
  .toPromise()

export const search = (index, txt) => asyncFetch(`${url}/search/${index}/_query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: txt
  })
}).chain(toJSON)
  .toPromise()




