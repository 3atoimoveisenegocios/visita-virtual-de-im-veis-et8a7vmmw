migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('properties')
    if (!col.fields.getByName('rental_price')) {
      col.fields.add(new NumberField({ name: 'rental_price', min: 0 }))
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('properties')
    if (col.fields.getByName('rental_price')) {
      col.fields.removeByName('rental_price')
      app.save(col)
    }
  },
)
