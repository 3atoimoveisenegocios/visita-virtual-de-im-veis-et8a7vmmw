migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('properties')
    if (!col.fields.getByName('background_music')) {
      col.fields.add(
        new FileField({
          name: 'background_music',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: [
            'audio/mpeg',
            'audio/mp3',
            'audio/mp4',
            'audio/x-m4a',
            'audio/aac',
            'audio/ogg',
            'audio/wav',
            'audio/webm',
          ],
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('properties')
      col.fields.removeByName('background_music')
      app.save(col)
    } catch (_) {}
  },
)
