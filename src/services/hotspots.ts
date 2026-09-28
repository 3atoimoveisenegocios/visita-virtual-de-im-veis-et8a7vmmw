import pb from '@/lib/pocketbase/client'
import type { Hotspot } from '@/types'

export const hotspotsService = {
  async getHotspotsByRoom(roomId: string): Promise<Hotspot[]> {
    return await pb.collection('hotspots').getFullList<Hotspot>({
      filter: `room = "${roomId}"`,
      expand: 'room,target_room,nav_point,target_nav_point',
    })
  },

  async getHotspotsByNavPoint(navPointId: string): Promise<Hotspot[]> {
    return await pb.collection('hotspots').getFullList<Hotspot>({
      filter: `nav_point = "${navPointId}"`,
      expand: 'room,target_room,nav_point,target_nav_point',
    })
  },

  async getHotspotsForRooms(roomIds: string[]): Promise<Hotspot[]> {
    if (roomIds.length === 0) return []
    const filter = roomIds.map((id) => `room = "${id}"`).join(' || ')
    return await pb.collection('hotspots').getFullList<Hotspot>({
      filter,
      expand: 'room,target_room,nav_point,target_nav_point',
    })
  },

  async createHotspot(data: {
    room: string
    target_room: string
    nav_point?: string
    target_nav_point?: string
    direction: number
    type?: 'step' | 'door'
    label?: string
    arrow_size_desktop?: 'pequeno' | 'medio' | 'grande'
    arrow_size_mobile?: 'pequeno' | 'medio' | 'grande'
    arrow_orientation?: 'reta' | 'esquerda' | 'direita' | 'personalizado'
    arrow_rotation?: number
  }): Promise<Hotspot> {
    return await pb.collection('hotspots').create<Hotspot>(data, {
      expand: 'room,target_room,nav_point,target_nav_point',
    })
  },

  async updateHotspot(id: string, data: Partial<Hotspot>): Promise<Hotspot> {
    return await pb.collection('hotspots').update<Hotspot>(id, data, {
      expand: 'room,target_room,nav_point,target_nav_point',
    })
  },

  async deleteHotspot(id: string): Promise<boolean> {
    return await pb.collection('hotspots').delete(id)
  },
}
