migrate(
  (app) => {
    const hotspotsCol = app.findCollectionByNameOrId('hotspots')

    // Pitch (inclinação vertical) de -90 a +90 graus
    if (!hotspotsCol.fields.getByName('pitch')) {
      hotspotsCol.fields.add(
        new NumberField({
          name: 'pitch',
          min: -90,
          max: 90,
        }),
      )
    }

    app.save(hotspotsCol)
  },
  (app) => {
    try {
      const hotspotsCol = app.findCollectionByNameOrId('hotspots')
      if (hotspotsCol.fields.getByName('pitch')) {
        hotspotsCol.fields.removeByName('pitch')
        app.save(hotspotsCol)
      }
    } catch (_) {}
  },
)
