// Torna o preço de venda (price) opcional: imóveis somente para locação
// não precisam ter preço de venda. Idempotente via getByName.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('properties')
    const field = col.fields.getByName('price')
    if (field && field.required) {
      field.required = false
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('properties')
    const field = col.fields.getByName('price')
    if (field && !field.required) {
      field.required = true
      app.save(col)
    }
  },
)
