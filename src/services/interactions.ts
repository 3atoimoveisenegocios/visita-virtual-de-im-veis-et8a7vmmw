import pb from '@/lib/pocketbase/client'
import type { Interaction, InteractionEventType } from '@/types'

export const interactionsService = {
  async recordInteraction(
    propertyId: string,
    eventType: InteractionEventType,
    roomId?: string,
  ): Promise<void> {
    try {
      await pb.collection('interactions').create<Interaction>({
        property: propertyId,
        room: roomId || null,
        event_type: eventType,
      })
    } catch (err) {
      // Do not block user tour experience if analytics recording fails
      console.warn('Falha ao registrar interação:', err)
    }
  },

  async getInteractionsByProperty(propertyId: string): Promise<Interaction[]> {
    return await pb.collection('interactions').getFullList<Interaction>({
      filter: `property = "${propertyId}"`,
      sort: '-created',
    })
  },
}
