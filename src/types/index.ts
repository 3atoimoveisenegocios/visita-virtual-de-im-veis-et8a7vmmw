export interface Property {
  id: string
  title: string
  neighborhood: string
  city: string
  price: number
  area_m2?: number
  bedrooms?: number
  bathrooms?: number
  parking_spots?: number
  description?: string
  whatsapp_number?: string
  published: boolean
  floor_plan_image?: string
  created: string
  updated: string
  collectionId?: string
}

export interface Room {
  id: string
  property: string
  name: string
  description?: string
  dimensions?: string
  panorama_image?: string
  created: string
  updated: string
  collectionId?: string
}

export interface Hotspot {
  id: string
  room: string
  target_room: string
  direction: number // 0 to 360
  created: string
  updated: string
  expand?: {
    room?: Room
    target_room?: Room
  }
}

export type InteractionEventType =
  | 'tour_started'
  | 'room_visited'
  | 'floor_plan_opened'
  | 'info_opened'
  | 'whatsapp_clicked'

export interface Interaction {
  id: string
  property: string
  room?: string
  event_type: InteractionEventType
  created: string
  updated?: string
}

export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  verified?: boolean
}
