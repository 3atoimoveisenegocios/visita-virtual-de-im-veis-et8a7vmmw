import pb from '@/lib/pocketbase/client'
import type { SiteSettings, LogoSize } from '@/types'

export const settingsService = {
  /**
   * Fetches the singleton settings record. If none exists, creates one or returns null.
   */
  async getSettings(): Promise<SiteSettings | null> {
    try {
      const records = await pb.collection('settings').getList<SiteSettings>(1, 1, {
        sort: '-created',
      })
      if (records.items.length > 0) {
        return records.items[0]
      }
      return null
    } catch (err) {
      console.error('Erro ao buscar configurações:', err)
      return null
    }
  },

  /**
   * Updates the settings record. Accepts FormData for file uploads (hero_image, logo).
   */
  async updateSettings(id: string, data: FormData | Partial<SiteSettings>): Promise<SiteSettings> {
    return await pb.collection('settings').update<SiteSettings>(id, data)
  },

  /**
   * Creates a settings record if one does not exist yet.
   */
  async createSettings(data: FormData | Partial<SiteSettings>): Promise<SiteSettings> {
    return await pb.collection('settings').create<SiteSettings>(data)
  },

  /**
   * Helper to retrieve full URL of uploaded files in the settings collection
   */
  getFileUrl(
    record: { id: string; collectionId?: string; collectionName?: string },
    filename?: string,
  ): string {
    if (!filename) return ''
    return pb.files.getURL(record as any, filename)
  },

  /**
   * Helper mapping logo_size enum to CSS height classes and pixel equivalents:
   * pequeno: ~32px (h-8)
   * medio: ~48px (h-12)
   * grande: ~72px (h-[72px])
   */
  getLogoSizeClass(size?: LogoSize): string {
    switch (size) {
      case 'pequeno':
        return 'h-8 max-h-8 w-auto'
      case 'grande':
        return 'h-[72px] max-h-[72px] w-auto'
      case 'medio':
      default:
        return 'h-12 max-h-12 w-auto'
    }
  },
}
