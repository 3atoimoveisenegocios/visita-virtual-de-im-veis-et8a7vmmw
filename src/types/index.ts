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
  cover_image?: string
  floor_plan_image?: string
  background_music?: string
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
  initial_yaw?: number
  initial_pitch?: number
  created: string
  updated: string
  collectionId?: string
}

export interface NavPoint {
  id: string
  room: string
  name: string
  panorama_image?: string
  pos_x?: number
  pos_y?: number
  is_entry?: boolean
  order?: number
  initial_yaw?: number
  initial_pitch?: number
  point_size_desktop?: PointSize
  point_size_mobile?: PointSize
  created: string
  updated: string
  collectionId?: string
  expand?: {
    room?: Room
  }
}

export type ArrowSize = 'pequeno' | 'medio' | 'grande'
export type PointSize = 'pequeno' | 'medio' | 'grande'
export type ArrowOrientation = 'reta' | 'esquerda' | 'direita' | 'baixo' | 'personalizado'

export interface Hotspot {
  id: string
  room: string
  target_room: string
  nav_point?: string
  target_nav_point?: string
  direction: number // 0 to 360
  pitch?: number // -89.5 to 89.5 degrees
  type?: 'step' | 'door'
  label?: string
  arrow_size_desktop?: ArrowSize
  arrow_size_mobile?: ArrowSize
  arrow_orientation?: ArrowOrientation
  arrow_rotation?: number // in degrees
  created: string
  updated: string
  expand?: {
    room?: Room
    target_room?: Room
    nav_point?: NavPoint
    target_nav_point?: NavPoint
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

export type LogoSize = 'pequeno' | 'medio' | 'grande'

export interface SiteSettings {
  id: string
  hero_image?: string
  logo?: string
  agency_logo?: string
  logo_size?: LogoSize
  site_title?: string
  created: string
  updated: string
  collectionId?: string
}
