migrate(
  (app) => {
    // Collection settings
    const settings = new Collection({
      name: 'settings',
      type: 'base',
      listRule: '', // public read
      viewRule: '', // public read
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'hero_image',
          type: 'file',
          maxSelect: 1,
          maxSize: 15728640,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        {
          name: 'logo',
          type: 'file',
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
        },
        {
          name: 'logo_size',
          type: 'select',
          values: ['pequeno', 'medio', 'grande'],
          maxSelect: 1,
        },
        { name: 'site_title', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(settings)

    // Seed default settings singleton record
    const settingsCol = app.findCollectionByNameOrId('settings')
    const initialRecord = new Record(settingsCol)
    initialRecord.set('logo_size', 'medio')
    initialRecord.set('site_title', 'Visita Virtual de Imóveis')
    app.save(initialRecord)
  },
  (app) => {
    try {
      const settings = app.findCollectionByNameOrId('settings')
      app.delete(settings)
    } catch (_) {}
  },
)
