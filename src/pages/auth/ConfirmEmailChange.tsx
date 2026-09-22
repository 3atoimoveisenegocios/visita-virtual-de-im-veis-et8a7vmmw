import React, { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { authService } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Lock, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ConfirmEmailChange() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error('Token ausente.')
      return
    }

    try {
      setLoading(true)
      await authService.confirmEmailChange(token, password)
      setSuccess(true)
      toast.success('E-mail alterado com sucesso! Faça login novamente.')
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao confirmar troca de email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#E2E6E9] shadow-xl bg-white rounded-2xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold text-[#1C2B36]">Confirmar Novo E-mail</CardTitle>
          <CardDescription className="text-xs text-[#5B6B76]">
            Digite sua senha atual para confirmar a alteração do endereço de e-mail
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm text-[#1C2B36] font-medium">Endereço de e-mail atualizado!</p>
              <Button asChild className="bg-[#1F4E5F] text-white">
                <Link to="/admin">Fazer login com novo e-mail</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pass" className="text-xs font-semibold text-[#1C2B36]">
                  Sua Senha
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-[#5B6B76]" />
                  <Input
                    id="pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 text-sm rounded-xl border-[#E2E6E9]"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1F4E5F] hover:bg-[#18404E] text-white font-semibold py-5 rounded-xl shadow-sm"
              >
                {loading ? 'Confirmando...' : 'Confirmar Troca de E-mail'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
