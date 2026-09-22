import pb from '@/lib/pocketbase/client'
import type { NavPoint } from '@/types'

export const navPointsService = {
  async getNavPointsByRoom(roomId: string): Promise<NavPoint[]> {
    return await pb.collection('nav_points').getFullList<NavPoint>({
      filter: `room = "${roomId}"`,
      sort: 'order,created',
    })
  },

  async getNavPointsByRooms(roomIds: string[]): Promise<NavPoint[]> {
    if (roomIds.length === 0) return []
    const filter = roomIds.map((id) => `room = "${id}"`).join(' || ')
    return await pb.collection('nav_points').getFullList<NavPoint>({
      filter,
      sort: 'order,created',
    })
  },

  async getNavPointById(id: string): Promise<NavPoint> {
    return await pb.collection('nav_points').getOne<NavPoint>(id)
  },

  async createNavPoint(data: FormData | Partial<NavPoint>): Promise<NavPoint> {
    return await pb.collection('nav_points').create<NavPoint>(data)
  },

  async updateNavPoint(id: string, data: FormData | Partial<NavPoint>): Promise<NavPoint> {
    return await pb.collection('nav_points').update<NavPoint>(id, data)
  },

  async deleteNavPoint(id: string): Promise<boolean> {
    return await pb.collection('nav_points').delete(id)
  },

  getFileUrl(record: { id: string; collectionId?: string }, filename?: string): string {
    if (!filename) return ''
    return pb.files.getURL(record as any, filename)
  },
}
