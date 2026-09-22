migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('settings')
    if (!col.fields.getByName('agency_logo')) {
      col.fields.add(
        new FileField({
          name: 'agency_logo',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('settings')
      col.fields.removeByName('agency_logo')
      app.save(col)
    } catch (_) {}
  },
)
