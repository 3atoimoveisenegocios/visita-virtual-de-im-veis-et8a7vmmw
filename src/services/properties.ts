import pb from '@/lib/pocketbase/client'
import type { Property } from '@/types'

export const propertiesService = {
  async getPublishedProperties(): Promise<Property[]> {
    return await pb.collection('properties').getFullList<Property>({
      filter: 'published = true',
      sort: '-created',
    })
  },

  async getAllProperties(): Promise<Property[]> {
    return await pb.collection('properties').getFullList<Property>({
      sort: '-created',
    })
  },

  async getPropertyById(id: string): Promise<Property> {
    return await pb.collection('properties').getOne<Property>(id)
  },

  async createProperty(data: FormData | Partial<Property>): Promise<Property> {
    return await pb.collection('properties').create<Property>(data)
  },

  async updateProperty(id: string, data: FormData | Partial<Property>): Promise<Property> {
    return await pb.collection('properties').update<Property>(id, data)
  },

  async togglePublish(id: string, published: boolean): Promise<Property> {
    return await pb.collection('properties').update<Property>(id, { published })
  },

  async deleteProperty(id: string): Promise<boolean> {
    return await pb.collection('properties').delete(id)
  },

  getFileUrl(record: { id: string; collectionId?: string }, filename?: string): string {
    if (!filename) return ''
    return pb.files.getURL(record as any, filename)
  },
}
