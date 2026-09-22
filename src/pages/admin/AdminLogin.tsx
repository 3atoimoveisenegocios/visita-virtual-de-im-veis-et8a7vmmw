import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authService } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Compass, LogIn, Lock, Mail, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('3atoimoveis@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email || !password) {
      setErrorMsg('Por favor, preencha email e senha.')
      return
    }

    try {
      setLoading(true)
      await authService.login(email, password)
      toast.success('Login efetuado com sucesso!')
      navigate('/admin/imoveis')
    } catch (err: any) {
      console.error('Erro de login:', err)
      setErrorMsg(err?.message || 'Email ou senha inválidos. Verifique suas credenciais.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#E2E6E9] shadow-xl bg-white rounded-2xl">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 rounded-xl bg-[#1F4E5F] flex items-center justify-center text-white mx-auto mb-3 shadow-md">
            <Compass className="w-6 h-6 text-[#E07A3F]" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#1C2B36]">Painel do Corretor</CardTitle>
          <CardDescription className="text-xs text-[#5B6B76]">
            Gerencie imóveis, publique visitas 360° e configure os ambientes
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-[#1C2B36]">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-[#5B6B76]" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="corretor@imoveis.com.br"
                  className="pl-9 text-sm rounded-xl border-[#E2E6E9]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-[#1C2B36]">
                  Senha
                </Label>
                <Link to="/forgot-password" className="text-xs text-[#1F4E5F] hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-[#5B6B76]" />
                <Input
                  id="password"
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
              className="w-full bg-[#1F4E5F] hover:bg-[#18404E] text-white font-semibold py-5 rounded-xl shadow-sm transition-all mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <LogIn className="w-4 h-4" />
                  <span>Entrar no Painel</span>
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#E2E6E9] text-center">
            <p className="text-xs text-[#5B6B76]">
              Credenciais demonstrativas pré-preenchidas para teste imediato.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
