import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Code, Copy, Check, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface EmbedCodeButtonProps {
  propertyId: string
  propertyTitle?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  showText?: boolean
}

/**
 * Generates the iframe embed snippet for a virtual tour
 */
export function generateEmbedIframeCode(propertyId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const tourUrl = `${origin}/visita/${propertyId}?embed=1`
  return `<iframe src="${tourUrl}" width="100%" height="600" frameborder="0" allowfullscreen style="border:0;"></iframe>`
}

/**
 * Copies the text to clipboard with fallback for non-secure contexts
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (err) {
    console.warn('Falha no navigator.clipboard, usando fallback textarea:', err)
  }

  // Fallback using textarea execCommand
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.left = '-9999px'
    textarea.setAttribute('readonly', '')
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textarea)
    return successful
  } catch (err) {
    console.error('Falha no fallback de cópia:', err)
    return false
  }
}

export function EmbedCodeButton({
  propertyId,
  propertyTitle,
  variant = 'outline',
  size = 'sm',
  className,
  showText = true,
}: EmbedCodeButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const tourUrl = `${origin}/visita/${propertyId}?embed=1`
  const iframeSnippet = `<iframe src="${tourUrl}" width="100%" height="600" frameborder="0" allowfullscreen style="border:0;"></iframe>`

  const handleCopyDirect = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    const ok = await copyToClipboard(iframeSnippet)
    if (ok) {
      setCopied(true)
      toast.success('Código de incorporação copiado!')
      setTimeout(() => setCopied(false), 2500)
    } else {
      toast.error('Não foi possível copiar automaticamente. Selecione o código manualmente.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          title="Copiar código de incorporação (iframe)"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Code className="w-3.5 h-3.5 text-[#1F4E5F]" />
          )}
          {showText && <span className="ml-1.5">{copied ? 'Copiado!' : 'Incorporar (Embed)'}</span>}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl bg-white text-[#1C2B36] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[#1C2B36]">
            <Code className="w-5 h-5 text-[#E07A3F]" />
            <span>Código de Incorporação (Embed)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-[#5B6B76] pt-1">
            {propertyTitle ? (
              <>
                Incorpore o tour 360° de <strong>"{propertyTitle}"</strong> em sites parceiros,
                portais ou landing pages.
              </>
            ) : (
              'Incorpore este tour 360° em qualquer site ou portal parceiro.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Direct embed URL */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1C2B36]">
              URL Direta de Incorporação
            </Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={tourUrl}
                className="bg-slate-50 font-mono text-xs text-[#1C2B36] h-9 selection:bg-[#E07A3F]/20"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(tourUrl, '_blank', 'noopener,noreferrer')}
                className="h-9 px-2.5 shrink-0 text-xs border-[#E2E6E9]"
                title="Abrir prévia do embed em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-[#5B6B76]">
              O parâmetro{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-[#1F4E5F] font-semibold">
                ?embed=1
              </code>{' '}
              oculta cabeçalho, rodapé e margens, deixando apenas o visor 360° em tela cheia.
            </p>
          </div>

          {/* Iframe code */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1C2B36]">
              Código HTML pronto (tag &lt;iframe&gt;)
            </Label>
            <div className="relative">
              <textarea
                readOnly
                rows={4}
                value={iframeSnippet}
                onFocus={(e) => e.target.select()}
                className="w-full rounded-xl border border-[#E2E6E9] bg-slate-50 p-3 font-mono text-xs text-[#1C2B36] selection:bg-[#E07A3F]/20 focus:outline-none focus:ring-2 focus:ring-[#1F4E5F] resize-none"
              />
            </div>
            <p className="text-[11px] text-[#5B6B76]">
              Cole este código diretamente no HTML do seu site ou no bloco HTML do WordPress, Wix ou
              CMS.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="text-xs border-[#E2E6E9]"
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={() => handleCopyDirect()}
            className="bg-[#1F4E5F] hover:bg-[#18404E] text-white text-xs gap-1.5"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Código copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar código de incorporação</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
