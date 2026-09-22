migrate(
  (app) => {
    // 1. properties collection
    const properties = new Collection({
      name: 'properties',
      type: 'base',
      listRule: "published = true || @request.auth.id != ''",
      viewRule: "published = true || @request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'neighborhood', type: 'text', required: true },
        { name: 'city', type: 'text', required: true },
        { name: 'price', type: 'number', required: true },
        { name: 'area_m2', type: 'number' },
        { name: 'bedrooms', type: 'number' },
        { name: 'bathrooms', type: 'number' },
        { name: 'parking_spots', type: 'number' },
        { name: 'description', type: 'text' },
        { name: 'whatsapp_number', type: 'text' },
        { name: 'published', type: 'bool' },
        {
          name: 'floor_plan_image',
          type: 'file',
          maxSelect: 1,
          maxSize: 15728640,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_properties_published ON properties (published)',
        'CREATE INDEX idx_properties_created ON properties (created DESC)',
      ],
    })
    app.save(properties)

    const propertiesId = app.findCollectionByNameOrId('properties').id

    // 2. rooms collection
    const rooms = new Collection({
      name: 'rooms',
      type: 'base',
      listRule: "property.published = true || @request.auth.id != ''",
      viewRule: "property.published = true || @request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'property',
          type: 'relation',
          required: true,
          collectionId: propertiesId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'dimensions', type: 'text' },
        {
          name: 'panorama_image',
          type: 'file',
          maxSelect: 1,
          maxSize: 31457280,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_rooms_property ON rooms (property)',
        'CREATE INDEX idx_rooms_created ON rooms (created ASC)',
      ],
    })
    app.save(rooms)

    const roomsId = app.findCollectionByNameOrId('rooms').id

    // 3. hotspots collection
    const hotspots = new Collection({
      name: 'hotspots',
      type: 'base',
      listRule: "room.property.published = true || @request.auth.id != ''",
      viewRule: "room.property.published = true || @request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'room',
          type: 'relation',
          required: true,
          collectionId: roomsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'target_room',
          type: 'relation',
          required: true,
          collectionId: roomsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'direction', type: 'number', required: true, min: 0, max: 360 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_hotspots_room ON hotspots (room)',
        'CREATE INDEX idx_hotspots_target_room ON hotspots (target_room)',
      ],
    })
    app.save(hotspots)

    // 4. interactions collection
    const interactions = new Collection({
      name: 'interactions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '', // public can log interaction events
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'property',
          type: 'relation',
          required: true,
          collectionId: propertiesId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'room',
          type: 'relation',
          collectionId: roomsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'event_type',
          type: 'select',
          required: true,
          values: [
            'tour_started',
            'room_visited',
            'floor_plan_opened',
            'info_opened',
            'whatsapp_clicked',
          ],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_interactions_property ON interactions (property)',
        'CREATE INDEX idx_interactions_created ON interactions (created DESC)',
      ],
    })
    app.save(interactions)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('interactions'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('hotspots'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('rooms'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('properties'))
    } catch (_) {}
  },
)
