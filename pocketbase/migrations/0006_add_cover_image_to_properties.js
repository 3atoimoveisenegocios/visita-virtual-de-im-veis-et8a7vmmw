migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('properties')
    if (!col.fields.getByName('cover_image')) {
      col.fields.add(
        new FileField({
          name: 'cover_image',
          maxSelect: 1,
          maxSize: 15728640, // 15MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('properties')
      col.fields.removeByName('cover_image')
      app.save(col)
    } catch (_) {}
  },
)
