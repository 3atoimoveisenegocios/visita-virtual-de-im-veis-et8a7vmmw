import pb from '@/lib/pocketbase/client'
import type { Room } from '@/types'

export const roomsService = {
  async getRoomsByProperty(propertyId: string): Promise<Room[]> {
    return await pb.collection('rooms').getFullList<Room>({
      filter: `property = "${propertyId}"`,
      sort: 'created',
    })
  },

  async getRoomById(id: string): Promise<Room> {
    return await pb.collection('rooms').getOne<Room>(id)
  },

  async createRoom(data: FormData | Partial<Room>): Promise<Room> {
    return await pb.collection('rooms').create<Room>(data)
  },

  async updateRoom(id: string, data: FormData | Partial<Room>): Promise<Room> {
    return await pb.collection('rooms').update<Room>(id, data)
  },

  async deleteRoom(id: string): Promise<boolean> {
    return await pb.collection('rooms').delete(id)
  },

  getFileUrl(record: { id: string; collectionId?: string }, filename?: string): string {
    if (!filename) return ''
    return pb.files.getURL(record as any, filename)
  },
}
