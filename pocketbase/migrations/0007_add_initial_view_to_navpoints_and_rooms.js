migrate(
  (app) => {
    // 1. Add initial_yaw and initial_pitch to nav_points collection
    const navPointsCol = app.findCollectionByNameOrId('nav_points')
    if (!navPointsCol.fields.getByName('initial_yaw')) {
      navPointsCol.fields.add(
        new NumberField({
          name: 'initial_yaw',
          min: 0,
          max: 360,
        }),
      )
    }
    if (!navPointsCol.fields.getByName('initial_pitch')) {
      navPointsCol.fields.add(
        new NumberField({
          name: 'initial_pitch',
          min: -90,
          max: 90,
        }),
      )
    }
    app.save(navPointsCol)

    // 2. Also add initial_yaw and initial_pitch to rooms collection as default fallback
    const roomsCol = app.findCollectionByNameOrId('rooms')
    if (!roomsCol.fields.getByName('initial_yaw')) {
      roomsCol.fields.add(
        new NumberField({
          name: 'initial_yaw',
          min: 0,
          max: 360,
        }),
      )
    }
    if (!roomsCol.fields.getByName('initial_pitch')) {
      roomsCol.fields.add(
        new NumberField({
          name: 'initial_pitch',
          min: -90,
          max: 90,
        }),
      )
    }
    app.save(roomsCol)
  },
  (app) => {
    try {
      const navPointsCol = app.findCollectionByNameOrId('nav_points')
      if (navPointsCol.fields.getByName('initial_yaw')) {
        navPointsCol.fields.removeByName('initial_yaw')
      }
      if (navPointsCol.fields.getByName('initial_pitch')) {
        navPointsCol.fields.removeByName('initial_pitch')
      }
      app.save(navPointsCol)
    } catch (_) {}

    try {
      const roomsCol = app.findCollectionByNameOrId('rooms')
      if (roomsCol.fields.getByName('initial_yaw')) {
        roomsCol.fields.removeByName('initial_yaw')
      }
      if (roomsCol.fields.getByName('initial_pitch')) {
        roomsCol.fields.removeByName('initial_pitch')
      }
      app.save(roomsCol)
    } catch (_) {}
  },
)
