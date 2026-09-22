import React, { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { authService } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Lock, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error('Token de redefinição inválido ou ausente.')
      return
    }
    if (password !== passwordConfirm) {
      toast.error('As senhas digitadas não coincidem.')
      return
    }

    try {
      setLoading(true)
      await authService.confirmPasswordReset(token, password, passwordConfirm)
      setSuccess(true)
      toast.success('Senha redefinida com sucesso!')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao redefinir a senha. O token pode ter expirado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#E2E6E9] shadow-xl bg-white rounded-2xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold text-[#1C2B36]">Criar Nova Senha</CardTitle>
          <CardDescription className="text-xs text-[#5B6B76]">
            Digite sua nova senha para acessar o painel
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm text-[#1C2B36] font-medium">
                Sua senha foi alterada com sucesso!
              </p>
              <Button asChild className="bg-[#1F4E5F] text-white">
                <Link to="/admin">Fazer login agora</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pass" className="text-xs font-semibold text-[#1C2B36]">
                  Nova Senha (mínimo 8 caracteres)
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
                    minLength={8}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="passConf" className="text-xs font-semibold text-[#1C2B36]">
                  Confirmar Nova Senha
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-[#5B6B76]" />
                  <Input
                    id="passConf"
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 text-sm rounded-xl border-[#E2E6E9]"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1F4E5F] hover:bg-[#18404E] text-white font-semibold py-5 rounded-xl shadow-sm"
              >
                {loading ? 'Salvando nova senha...' : 'Redefinir Senha'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
