import pb from '@/lib/pocketbase/client'
import type { Hotspot } from '@/types'

export const hotspotsService = {
  async getHotspotsByRoom(roomId: string): Promise<Hotspot[]> {
    return await pb.collection('hotspots').getFullList<Hotspot>({
      filter: `room = "${roomId}"`,
      expand: 'target_room',
    })
  },

  async getHotspotsForRooms(roomIds: string[]): Promise<Hotspot[]> {
    if (roomIds.length === 0) return []
    const filter = roomIds.map((id) => `room = "${id}"`).join(' || ')
    return await pb.collection('hotspots').getFullList<Hotspot>({
      filter,
      expand: 'room,target_room',
    })
  },

  async createHotspot(data: {
    room: string
    target_room: string
    direction: number
  }): Promise<Hotspot> {
    return await pb.collection('hotspots').create<Hotspot>(data, {
      expand: 'target_room',
    })
  },

  async updateHotspot(id: string, data: Partial<Hotspot>): Promise<Hotspot> {
    return await pb.collection('hotspots').update<Hotspot>(id, data, {
      expand: 'target_room',
    })
  },

  async deleteHotspot(id: string): Promise<boolean> {
    return await pb.collection('hotspots').delete(id)
  },
}
