migrate(
  (app) => {
    const hotspotsCol = app.findCollectionByNameOrId('hotspots')

    const orientationField = hotspotsCol.fields.getByName('arrow_orientation')
    if (orientationField) {
      orientationField.values = ['reta', 'esquerda', 'direita', 'baixo', 'personalizado']
      orientationField.maxSelect = 1
    } else {
      hotspotsCol.fields.add(
        new SelectField({
          name: 'arrow_orientation',
          values: ['reta', 'esquerda', 'direita', 'baixo', 'personalizado'],
          maxSelect: 1,
        }),
      )
    }

    app.save(hotspotsCol)
  },
  (app) => {
    try {
      const hotspotsCol = app.findCollectionByNameOrId('hotspots')
      const orientationField = hotspotsCol.fields.getByName('arrow_orientation')
      if (orientationField) {
        orientationField.values = ['reta', 'esquerda', 'direita', 'personalizado']
        app.save(hotspotsCol)
      }
    } catch (_) {}
  },
)
