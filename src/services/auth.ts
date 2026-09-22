import pb from '@/lib/pocketbase/client'
import type { User } from '@/types'

export const authService = {
  getCurrentUser(): User | null {
    if (!pb.authStore.isValid || !pb.authStore.record) return null
    const r = pb.authStore.record
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      avatar: r.avatar,
      verified: r.verified,
    }
  },

  isAuthenticated(): boolean {
    return pb.authStore.isValid
  },

  async login(email: string, pass: string) {
    return await pb.collection('users').authWithPassword(email, pass)
  },

  logout() {
    pb.authStore.clear()
  },

  async requestPasswordReset(email: string) {
    return await pb.collection('users').requestPasswordReset(email)
  },

  async confirmPasswordReset(token: string, password: string, passwordConfirm: string) {
    return await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
  },

  async requestVerification(email: string) {
    return await pb.collection('users').requestVerification(email)
  },

  async confirmVerification(token: string) {
    return await pb.collection('users').confirmVerification(token)
  },

  async requestEmailChange(newEmail: string) {
    return await pb.collection('users').requestEmailChange(newEmail)
  },

  async confirmEmailChange(token: string, password: string) {
    const res = await pb.collection('users').confirmEmailChange(token, password)
    pb.authStore.clear() // User must log in with new email
    return res
  },
}
