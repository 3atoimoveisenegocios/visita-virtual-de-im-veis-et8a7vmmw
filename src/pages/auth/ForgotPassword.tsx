import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    try {
      setLoading(true)
      await authService.requestPasswordReset(email)
      setSubmitted(true)
      toast.success('Instruções de redefinição enviadas!')
    } catch (err: any) {
      // Don't leak user existence
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#E2E6E9] shadow-xl bg-white rounded-2xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold text-[#1C2B36]">Recuperação de Senha</CardTitle>
          <CardDescription className="text-xs text-[#5B6B76]">
            Informe seu e-mail para receber as instruções de recuperação
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {submitted ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm text-[#1C2B36] font-medium">
                Se houver uma conta associada a este e-mail, enviamos o link de recuperação.
              </p>
              <Button asChild className="bg-[#1F4E5F] text-white">
                <Link to="/admin">Voltar para o login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-[#1C2B36]">
                  E-mail cadastrado
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-[#5B6B76]" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
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
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/admin"
                  className="text-xs text-[#5B6B76] hover:text-[#1F4E5F] inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Voltar para o login</span>
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
