migrate(
  (app) => {
    const navPointsCol = app.findCollectionByNameOrId('nav_points')

    // 1. Desktop point size: 'pequeno' | 'medio' | 'grande' (padrão: medio)
    if (!navPointsCol.fields.getByName('point_size_desktop')) {
      navPointsCol.fields.add(
        new SelectField({
          name: 'point_size_desktop',
          values: ['pequeno', 'medio', 'grande'],
          maxSelect: 1,
        }),
      )
    }

    // 2. Mobile point size: 'pequeno' | 'medio' | 'grande' (padrão: medio)
    if (!navPointsCol.fields.getByName('point_size_mobile')) {
      navPointsCol.fields.add(
        new SelectField({
          name: 'point_size_mobile',
          values: ['pequeno', 'medio', 'grande'],
          maxSelect: 1,
        }),
      )
    }

    app.save(navPointsCol)
  },
  (app) => {
    try {
      const navPointsCol = app.findCollectionByNameOrId('nav_points')
      if (navPointsCol.fields.getByName('point_size_desktop')) {
        navPointsCol.fields.removeByName('point_size_desktop')
      }
      if (navPointsCol.fields.getByName('point_size_mobile')) {
        navPointsCol.fields.removeByName('point_size_mobile')
      }
      app.save(navPointsCol)
    } catch (_) {}
  },
)
