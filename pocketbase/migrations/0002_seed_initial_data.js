migrate(
  (app) => {
    // 1. Seed admin user 3atoimoveis@gmail.com
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let adminId = ''
    try {
      const existingAdmin = app.findAuthRecordByEmail('_pb_users_auth_', '3atoimoveis@gmail.com')
      adminId = existingAdmin.id
    } catch (_) {
      const adminRecord = new Record(users)
      adminRecord.setEmail('3atoimoveis@gmail.com')
      adminRecord.setPassword('Skip@Pass')
      adminRecord.setVerified(true)
      adminRecord.set('name', 'Corretor 3Ato Imóveis')
      app.save(adminRecord)
      adminId = adminRecord.id
    }

    const propertiesCol = app.findCollectionByNameOrId('properties')
    const roomsCol = app.findCollectionByNameOrId('rooms')
    const hotspotsCol = app.findCollectionByNameOrId('hotspots')

    // 2. Check if properties already exist
    const existingProps = app.findRecordsByFilter('properties', '', '-created', 10, 0)
    if (existingProps.length > 0) {
      return // Already seeded
    }

    // --- Imóvel 1: Apartamento Jardins (Publicado) ---
    const prop1 = new Record(propertiesCol)
    prop1.set('title', 'Apartamento de Alto Padrão nos Jardins')
    prop1.set('neighborhood', 'Jardins')
    prop1.set('city', 'São Paulo')
    prop1.set('price', 3450000)
    prop1.set('area_m2', 185)
    prop1.set('bedrooms', 3)
    prop1.set('bathrooms', 4)
    prop1.set('parking_spots', 3)
    prop1.set(
      'description',
      'Exclusivo apartamento reformado com acabamentos nobres nos Jardins. Living integrado para 3 ambientes, varanda gourmet envidraçada, suíte master com closet walk-in e hidromassagem. Cozinha planejada com ilha central e automação residencial completa.',
    )
    prop1.set('whatsapp_number', '5511999998888')
    prop1.set('published', true)
    app.save(prop1)

    // Ambientes do Imóvel 1
    const r1_sala = new Record(roomsCol)
    r1_sala.set('property', prop1.id)
    r1_sala.set('name', 'Living Integrado & Varanda')
    r1_sala.set(
      'description',
      'Amplo living com pé direito duplo, iluminação cênica e piso em madeira nobre.',
    )
    r1_sala.set('dimensions', '7.5m x 5.8m (43.5m²)')
    app.save(r1_sala)

    const r1_suite = new Record(roomsCol)
    r1_suite.set('property', prop1.id)
    r1_suite.set('name', 'Suíte Master')
    r1_suite.set('description', 'Suíte principal espaçosa com closet walk-in e vista arborizada.')
    r1_suite.set('dimensions', '5.2m x 4.6m (24m²)')
    app.save(r1_suite)

    const r1_cozinha = new Record(roomsCol)
    r1_cozinha.set('property', prop1.id)
    r1_cozinha.set('name', 'Cozinha Gourmet')
    r1_cozinha.set(
      'description',
      'Cozinha com bancada em mármore, armários planejados e despensa embutida.',
    )
    r1_cozinha.set('dimensions', '4.8m x 3.6m (17.2m²)')
    app.save(r1_cozinha)

    // Hotspots Imóvel 1
    // De Living -> Suíte Master (direção 45°)
    const h1_1 = new Record(hotspotsCol)
    h1_1.set('room', r1_sala.id)
    h1_1.set('target_room', r1_suite.id)
    h1_1.set('direction', 45)
    app.save(h1_1)

    // De Living -> Cozinha Gourmet (direção 190°)
    const h1_2 = new Record(hotspotsCol)
    h1_2.set('room', r1_sala.id)
    h1_2.set('target_room', r1_cozinha.id)
    h1_2.set('direction', 190)
    app.save(h1_2)

    // De Suíte Master -> Living (direção 225°)
    const h1_3 = new Record(hotspotsCol)
    h1_3.set('room', r1_suite.id)
    h1_3.set('target_room', r1_sala.id)
    h1_3.set('direction', 225)
    app.save(h1_3)

    // De Cozinha -> Living (direção 10°)
    const h1_4 = new Record(hotspotsCol)
    h1_4.set('room', r1_cozinha.id)
    h1_4.set('target_room', r1_sala.id)
    h1_4.set('direction', 10)
    app.save(h1_4)

    // --- Imóvel 2: Casa Contemporânea em Pinheiros (Não publicado) ---
    const prop2 = new Record(propertiesCol)
    prop2.set('title', 'Casa Contemporânea com Piscina')
    prop2.set('neighborhood', 'Pinheiros')
    prop2.set('city', 'São Paulo')
    prop2.set('price', 5200000)
    prop2.set('area_m2', 340)
    prop2.set('bedrooms', 4)
    prop2.set('bathrooms', 5)
    prop2.set('parking_spots', 4)
    prop2.set(
      'description',
      'Arquitetura arrojada em rua tranquila e arborizada de Pinheiros. Área externa espetacular com piscina aquecida, espaço gourmet com churrasqueira e jardim vertical.',
    )
    prop2.set('whatsapp_number', '5511988887777')
    prop2.set('published', false)
    app.save(prop2)

    const r2_jardim = new Record(roomsCol)
    r2_jardim.set('property', prop2.id)
    r2_jardim.set('name', 'Jardim e Área da Piscina')
    r2_jardim.set('description', 'Deck em madeira cumaru, piscina aquecida e lounge ao ar livre.')
    r2_jardim.set('dimensions', '12m x 8m (96m²)')
    app.save(r2_jardim)

    const r2_living = new Record(roomsCol)
    r2_living.set('property', prop2.id)
    r2_living.set('name', 'Living com Lareira')
    r2_living.set(
      'description',
      'Paredes de vidro com vista para o jardim, pé direito de 4 metros.',
    )
    r2_living.set('dimensions', '8.5m x 6m (51m²)')
    app.save(r2_living)

    const h2_1 = new Record(hotspotsCol)
    h2_1.set('room', r2_jardim.id)
    h2_1.set('target_room', r2_living.id)
    h2_1.set('direction', 350)
    app.save(h2_1)

    const h2_2 = new Record(hotspotsCol)
    h2_2.set('room', r2_living.id)
    h2_2.set('target_room', r2_jardim.id)
    h2_2.set('direction', 170)
    app.save(h2_2)

    // --- Imóvel 3: Studio Design na Vila Madalena (Não publicado) ---
    const prop3 = new Record(propertiesCol)
    prop3.set('title', 'Studio Design Mobiliado')
    prop3.set('neighborhood', 'Vila Madalena')
    prop3.set('city', 'São Paulo')
    prop3.set('price', 690000)
    prop3.set('area_m2', 48)
    prop3.set('bedrooms', 1)
    prop3.set('bathrooms', 1)
    prop3.set('parking_spots', 1)
    prop3.set(
      'description',
      'Studio moderno planejado por arquiteto, a poucos passos do metrô Vila Madalena. Condomínio com rooftop, piscina infinita e coworking completo.',
    )
    prop3.set('whatsapp_number', '5511977776666')
    prop3.set('published', false)
    app.save(prop3)

    const r3_studio = new Record(roomsCol)
    r3_studio.set('property', prop3.id)
    r3_studio.set('name', 'Espaço Integrado Studio')
    r3_studio.set(
      'description',
      'Ambiente multifuncional com marcenaria inteligente e varanda com vista aberta.',
    )
    r3_studio.set('dimensions', '6.8m x 5.2m (35.3m²)')
    app.save(r3_studio)

    const r3_rooftop = new Record(roomsCol)
    r3_rooftop.set('property', prop3.id)
    r3_rooftop.set('name', 'Rooftop do Edifício')
    r3_rooftop.set(
      'description',
      'Terraço panorâmico 360° com vista espetacular da cidade de São Paulo.',
    )
    r3_rooftop.set('dimensions', '15m x 10m (150m²)')
    app.save(r3_rooftop)

    const h3_1 = new Record(hotspotsCol)
    h3_1.set('room', r3_studio.id)
    h3_1.set('target_room', r3_rooftop.id)
    h3_1.set('direction', 80)
    app.save(h3_1)

    const h3_2 = new Record(hotspotsCol)
    h3_2.set('room', r3_rooftop.id)
    h3_2.set('target_room', r3_studio.id)
    h3_2.set('direction', 260)
    app.save(h3_2)
  },
  (app) => {
    // down migration
  },
)
