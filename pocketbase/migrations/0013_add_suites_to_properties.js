migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('properties')
    if (!col.fields.getByName('suites')) {
      col.fields.add(new NumberField({ name: 'suites', onlyInt: true, min: 0 }))
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('properties')
    if (col.fields.getByName('suites')) {
      col.fields.removeByName('suites')
      app.save(col)
    }
  },
)
