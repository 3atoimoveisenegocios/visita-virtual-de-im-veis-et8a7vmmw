migrate(
  (app) => {
    const hotspotsCol = app.findCollectionByNameOrId('hotspots')

    // 1. Desktop arrow size: 'pequeno' | 'medio' | 'grande'
    if (!hotspotsCol.fields.getByName('arrow_size_desktop')) {
      hotspotsCol.fields.add(
        new SelectField({
          name: 'arrow_size_desktop',
          values: ['pequeno', 'medio', 'grande'],
          maxSelect: 1,
        }),
      )
    }

    // 2. Mobile arrow size: 'pequeno' | 'medio' | 'grande'
    if (!hotspotsCol.fields.getByName('arrow_size_mobile')) {
      hotspotsCol.fields.add(
        new SelectField({
          name: 'arrow_size_mobile',
          values: ['pequeno', 'medio', 'grande'],
          maxSelect: 1,
        }),
      )
    }

    // 3. Arrow orientation preset: 'reta' | 'esquerda' | 'direita' | 'personalizado'
    if (!hotspotsCol.fields.getByName('arrow_orientation')) {
      hotspotsCol.fields.add(
        new SelectField({
          name: 'arrow_orientation',
          values: ['reta', 'esquerda', 'direita', 'personalizado'],
          maxSelect: 1,
        }),
      )
    }

    // 4. Fine arrow rotation in degrees (-180 to 180 or 0 to 360)
    if (!hotspotsCol.fields.getByName('arrow_rotation')) {
      hotspotsCol.fields.add(
        new NumberField({
          name: 'arrow_rotation',
          min: -360,
          max: 360,
        }),
      )
    }

    app.save(hotspotsCol)
  },
  (app) => {
    try {
      const hotspotsCol = app.findCollectionByNameOrId('hotspots')
      if (hotspotsCol.fields.getByName('arrow_size_desktop')) {
        hotspotsCol.fields.removeByName('arrow_size_desktop')
      }
      if (hotspotsCol.fields.getByName('arrow_size_mobile')) {
        hotspotsCol.fields.removeByName('arrow_size_mobile')
      }
      if (hotspotsCol.fields.getByName('arrow_orientation')) {
        hotspotsCol.fields.removeByName('arrow_orientation')
      }
      if (hotspotsCol.fields.getByName('arrow_rotation')) {
        hotspotsCol.fields.removeByName('arrow_rotation')
      }
      app.save(hotspotsCol)
    } catch (_) {}
  },
)
