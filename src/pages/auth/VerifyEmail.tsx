import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { authService } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function verify() {
      if (!token) {
        setStatus('error')
        setErrorMsg('Token de verificação ausente.')
        return
      }

      try {
        await authService.confirmVerification(token)
        setStatus('success')
      } catch (err: any) {
        setStatus('error')
        setErrorMsg(err?.message || 'Token expirado ou inválido.')
      }
    }
    verify()
  }, [token])

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#E2E6E9] shadow-xl bg-white rounded-2xl text-center p-6">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-[#1C2B36]">Verificação de E-mail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center py-6">
              <Loader2 className="w-10 h-10 text-[#1F4E5F] animate-spin mb-3" />
              <p className="text-sm text-[#5B6B76]">Validando link de confirmação...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-4 space-y-4">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm text-[#1C2B36] font-medium">
                Seu e-mail foi verificado com sucesso!
              </p>
              <Button asChild className="bg-[#1F4E5F] text-white">
                <Link to="/admin">Acessar Painel</Link>
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-4 space-y-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
              <Button asChild variant="outline">
                <Link to="/admin">Voltar para o Login</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
