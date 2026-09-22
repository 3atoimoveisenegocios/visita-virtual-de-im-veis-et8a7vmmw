migrate(
  (app) => {
    const roomsCol = app.findCollectionByNameOrId('rooms')
    const roomsId = roomsCol.id

    // 1. Create nav_points collection
    const navPoints = new Collection({
      name: 'nav_points',
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
        { name: 'name', type: 'text', required: true },
        {
          name: 'panorama_image',
          type: 'file',
          maxSelect: 1,
          maxSize: 31457280,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'pos_x', type: 'number', min: 0, max: 100 },
        { name: 'pos_y', type: 'number', min: 0, max: 100 },
        { name: 'is_entry', type: 'bool' },
        { name: 'order', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_nav_points_room ON nav_points (room)',
        'CREATE INDEX idx_nav_points_created ON nav_points (created ASC)',
      ],
    })
    app.save(navPoints)

    const navPointsId = app.findCollectionByNameOrId('nav_points').id

    // 2. Add nav_point, target_nav_point and type to hotspots collection
    const hotspotsCol = app.findCollectionByNameOrId('hotspots')
    if (!hotspotsCol.fields.getByName('nav_point')) {
      hotspotsCol.fields.add(
        new RelationField({
          name: 'nav_point',
          collectionId: navPointsId,
          cascadeDelete: true,
          maxSelect: 1,
        }),
      )
    }
    if (!hotspotsCol.fields.getByName('target_nav_point')) {
      hotspotsCol.fields.add(
        new RelationField({
          name: 'target_nav_point',
          collectionId: navPointsId,
          cascadeDelete: true,
          maxSelect: 1,
        }),
      )
    }
    if (!hotspotsCol.fields.getByName('type')) {
      hotspotsCol.fields.add(
        new SelectField({
          name: 'type',
          values: ['step', 'door'],
          maxSelect: 1,
        }),
      )
    }
    if (!hotspotsCol.fields.getByName('label')) {
      hotspotsCol.fields.add(
        new TextField({
          name: 'label',
        }),
      )
    }
    app.save(hotspotsCol)

    // 3. Migrate existing rooms & hotspots:
    // Create a default nav_point for each existing room
    const allRooms = app.findRecordsByFilter('rooms', '', 'created', 100, 0)
    const roomToDefaultPoint = {}

    for (let i = 0; i < allRooms.length; i++) {
      const rm = allRooms[i]
      const np = new Record(navPoints)
      np.set('room', rm.id)
      np.set('name', 'Ponto Principal - ' + rm.get('name'))
      np.set('is_entry', true)
      np.set('order', 1)
      np.set('pos_x', 50)
      np.set('pos_y', 50)
      app.save(np)
      roomToDefaultPoint[rm.id] = np.id
    }

    // Update existing hotspots to link to the corresponding default nav_points
    const allHotspots = app.findRecordsByFilter('hotspots', '', 'created', 200, 0)
    for (let j = 0; j < allHotspots.length; j++) {
      const hs = allHotspots[j]
      const rId = hs.get('room')
      const targetRId = hs.get('target_room')
      if (roomToDefaultPoint[rId]) {
        hs.set('nav_point', roomToDefaultPoint[rId])
      }
      if (roomToDefaultPoint[targetRId]) {
        hs.set('target_nav_point', roomToDefaultPoint[targetRId])
      }
      hs.set('type', 'door')
      app.save(hs)
    }

    // 4. Seed 3 extra navigation points for the Living room in Apartamento Jardins (prop1)
    // Find Living Integrado & Varanda
    try {
      const livingRoom = app.findFirstRecordByData('rooms', 'name', 'Living Integrado & Varanda')
      const suiteRoom = app.findFirstRecordByData('rooms', 'name', 'Suíte Master')
      const cozinhaRoom = app.findFirstRecordByData('rooms', 'name', 'Cozinha Gourmet')

      if (livingRoom) {
        // Point 1: Living - Centro / Sofá (rename existing or create)
        const p1Id = roomToDefaultPoint[livingRoom.id]
        if (p1Id) {
          const p1 = app.findRecordById('nav_points', p1Id)
          p1.set('name', 'Living - Área de Estar / Sofá')
          p1.set('pos_x', 35)
          p1.set('pos_y', 45)
          app.save(p1)

          // Point 2: Living - Sala de Jantar
          const p2 = new Record(navPoints)
          p2.set('room', livingRoom.id)
          p2.set('name', 'Living - Mesa de Jantar')
          p2.set('pos_x', 60)
          p2.set('pos_y', 40)
          p2.set('is_entry', false)
          p2.set('order', 2)
          app.save(p2)

          // Point 3: Living - Varanda Gourmet
          const p3 = new Record(navPoints)
          p3.set('room', livingRoom.id)
          p3.set('name', 'Living - Varanda Gourmet Envidraçada')
          p3.set('pos_x', 45)
          p3.set('pos_y', 75)
          p3.set('is_entry', false)
          p3.set('order', 3)
          app.save(p3)

          // Hotspots de deslocamento interno (Street View style):
          // p1 -> p2 (Mesa de Jantar a leste, ~80°)
          const hs1_2 = new Record(hotspotsCol)
          hs1_2.set('room', livingRoom.id)
          hs1_2.set('target_room', livingRoom.id)
          hs1_2.set('nav_point', p1.id)
          hs1_2.set('target_nav_point', p2.id)
          hs1_2.set('direction', 85)
          hs1_2.set('type', 'step')
          hs1_2.set('label', 'Ir para Sala de Jantar')
          app.save(hs1_2)

          // p2 -> p1 (De volta ao Sofá a oeste, ~265°)
          const hs2_1 = new Record(hotspotsCol)
          hs2_1.set('room', livingRoom.id)
          hs2_1.set('target_room', livingRoom.id)
          hs2_1.set('nav_point', p2.id)
          hs2_1.set('target_nav_point', p1.id)
          hs2_1.set('direction', 265)
          hs2_1.set('type', 'step')
          hs2_1.set('label', 'Ir para Sofá / Estar')
          app.save(hs2_1)

          // p1 -> p3 (Em direção à Varanda para frente/sul, ~175°)
          const hs1_3 = new Record(hotspotsCol)
          hs1_3.set('room', livingRoom.id)
          hs1_3.set('target_room', livingRoom.id)
          hs1_3.set('nav_point', p1.id)
          hs1_3.set('target_nav_point', p3.id)
          hs1_3.set('direction', 175)
          hs1_3.set('type', 'step')
          hs1_3.set('label', 'Ir para Varanda Gourmet')
          app.save(hs1_3)

          // p3 -> p1 (De volta da Varanda ao Estar, ~355°)
          const hs3_1 = new Record(hotspotsCol)
          hs3_1.set('room', livingRoom.id)
          hs3_1.set('target_room', livingRoom.id)
          hs3_1.set('nav_point', p3.id)
          hs3_1.set('target_nav_point', p1.id)
          hs3_1.set('direction', 355)
          hs3_1.set('type', 'step')
          hs3_1.set('label', 'Voltar para Living Estar')
          app.save(hs3_1)

          // p2 -> p3 (Da Sala de Jantar para Varanda, ~210°)
          const hs2_3 = new Record(hotspotsCol)
          hs2_3.set('room', livingRoom.id)
          hs2_3.set('target_room', livingRoom.id)
          hs2_3.set('nav_point', p2.id)
          hs2_3.set('target_nav_point', p3.id)
          hs2_3.set('direction', 210)
          hs2_3.set('type', 'step')
          hs2_3.set('label', 'Ir para Varanda')
          app.save(hs2_3)

          // p3 -> p2 (Da Varanda para Sala de Jantar, ~30°)
          const hs3_2 = new Record(hotspotsCol)
          hs3_2.set('room', livingRoom.id)
          hs3_2.set('target_room', livingRoom.id)
          hs3_2.set('nav_point', p3.id)
          hs3_2.set('target_nav_point', p2.id)
          hs3_2.set('direction', 30)
          hs3_2.set('type', 'step')
          hs3_2.set('label', 'Ir para Sala de Jantar')
          app.save(hs3_2)

          // Conexão da Sala de Jantar para a Cozinha Gourmet
          if (cozinhaRoom && roomToDefaultPoint[cozinhaRoom.id]) {
            const hsJantarCozinha = new Record(hotspotsCol)
            hsJantarCozinha.set('room', livingRoom.id)
            hsJantarCozinha.set('target_room', cozinhaRoom.id)
            hsJantarCozinha.set('nav_point', p2.id)
            hsJantarCozinha.set('target_nav_point', roomToDefaultPoint[cozinhaRoom.id])
            hsJantarCozinha.set('direction', 120)
            hsJantarCozinha.set('type', 'door')
            hsJantarCozinha.set('label', 'Acessar Cozinha Gourmet')
            app.save(hsJantarCozinha)
          }
        }
      }
    } catch (e) {
      console.log('Seed extra nav_points error:', e)
    }
  },
  (app) => {
    try {
      const hotspotsCol = app.findCollectionByNameOrId('hotspots')
      if (hotspotsCol.fields.getByName('nav_point')) {
        hotspotsCol.fields.removeByName('nav_point')
      }
      if (hotspotsCol.fields.getByName('target_nav_point')) {
        hotspotsCol.fields.removeByName('target_nav_point')
      }
      if (hotspotsCol.fields.getByName('type')) {
        hotspotsCol.fields.removeByName('type')
      }
      if (hotspotsCol.fields.getByName('label')) {
        hotspotsCol.fields.removeByName('label')
      }
      app.save(hotspotsCol)
    } catch (_) {}

    try {
      const navPoints = app.findCollectionByNameOrId('nav_points')
      app.delete(navPoints)
    } catch (_) {}
  },
)
