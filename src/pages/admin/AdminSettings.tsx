import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth'
import { settingsService } from '@/services/settings'
import type { SiteSettings, LogoSize } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import {
  Palette,
  Upload,
  Image as ImageIcon,
  Check,
  Save,
  Trash2,
  Sparkles,
  Compass,
} from 'lucide-react'

export default function AdminSettings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SiteSettings | null>(null)

  // Local state for edits
  const [logoSize, setLogoSize] = useState<LogoSize>('medio')
  const [heroFile, setHeroFile] = useState<File | null>(null)
  const [heroPreview, setHeroPreview] = useState<string>('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')

  // Track removal of existing files
  const [removeHero, setRemoveHero] = useState(false)
  const [removeLogo, setRemoveLogo] = useState(false)

  const heroInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/admin')
      return
    }

    async function load() {
      try {
        setLoading(true)
        const data = await settingsService.getSettings()
        if (data) {
          setSettings(data)
          setLogoSize((data.logo_size as LogoSize) || 'medio')
          if (data.hero_image) {
            setHeroPreview(settingsService.getFileUrl(data, data.hero_image))
          }
          if (data.logo) {
            setLogoPreview(settingsService.getFileUrl(data, data.logo))
          }
        }
      } catch (err: any) {
        toast.error('Erro ao carregar configurações: ' + (err?.message || ''))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [navigate])

  const handleHeroSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido (JPEG, PNG ou WebP).')
      return
    }
    setHeroFile(file)
    setRemoveHero(false)
    const url = URL.createObjectURL(file)
    setHeroPreview(url)
  }

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido (PNG, SVG, JPEG ou WebP).')
      return
    }
    setLogoFile(file)
    setRemoveLogo(false)
    const url = URL.createObjectURL(file)
    setLogoPreview(url)
  }

  const handleClearHero = () => {
    setHeroFile(null)
    setHeroPreview('')
    setRemoveHero(true)
    if (heroInputRef.current) heroInputRef.current.value = ''
  }

  const handleClearLogo = () => {
    setLogoFile(null)
    setLogoPreview('')
    setRemoveLogo(true)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const formData = new FormData()
      formData.append('logo_size', logoSize)

      if (heroFile) {
        formData.append('hero_image', heroFile)
      } else if (removeHero) {
        formData.append('hero_image', '')
      }

      if (logoFile) {
        formData.append('logo', logoFile)
      } else if (removeLogo) {
        formData.append('logo', '')
      }

      let updated: SiteSettings
      if (settings?.id) {
        updated = await settingsService.updateSettings(settings.id, formData)
      } else {
        updated = await settingsService.createSettings(formData)
      }

      setSettings(updated)
      setHeroFile(null)
      setLogoFile(null)
      setRemoveHero(false)
      setRemoveLogo(false)

      if (updated.hero_image) {
        setHeroPreview(settingsService.getFileUrl(updated, updated.hero_image))
      } else {
        setHeroPreview('')
      }

      if (updated.logo) {
        setLogoPreview(settingsService.getFileUrl(updated, updated.logo))
      } else {
        setLogoPreview('')
      }

      toast.success('Configurações de aparência salvas com sucesso!')

      // Disparar evento para atualizar Layout em tempo real sem reload forçado
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: updated }))
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao salvar configurações: ' + (err?.message || 'Tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E6E9] shadow-sm">
        <h1 className="text-2xl font-bold text-[#1C2B36] flex items-center gap-2">
          <Palette className="w-6 h-6 text-[#1F4E5F]" />
          <span>Aparência e Personalização</span>
        </h1>
        <p className="text-xs text-[#5B6B76] mt-1">
          Personalize a identidade visual do portal: banner principal (hero da tela inicial), logo
          da barra superior e tamanho de exibição.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#E2E6E9]">
          <div className="w-8 h-8 border-4 border-[#1F4E5F]/30 border-t-[#1F4E5F] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#5B6B76]">Carregando configurações visuais...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Hero Banner */}
          <Card className="rounded-2xl border-[#E2E6E9] shadow-sm">
            <CardHeader className="pb-4 border-b border-[#E2E6E9]">
              <CardTitle className="text-lg font-bold text-[#1C2B36] flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#E07A3F]" />
                <span>Banner Principal da Tela Inicial (Hero)</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#5B6B76]">
                Substitui a imagem padrão de fundo da tela inicial. Recomendado: imagem de alta
                resolução (1920x1080 ou foto panorâmica/decorada).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {heroPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-[#E2E6E9] bg-slate-900 group">
                  <img
                    src={heroPreview}
                    alt="Pré-visualização do Hero"
                    className="w-full h-56 md:h-72 object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => heroInputRef.current?.click()}
                      className="bg-white/90 hover:bg-white text-xs font-semibold"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Trocar Imagem
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleClearHero}
                      className="text-xs font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Remover Imagem
                    </Button>
                  </div>
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-[10px]">
                    {heroFile ? `Novo arquivo: ${heroFile.name}` : 'Banner atual salvo'}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => heroInputRef.current?.click()}
                  className="border-2 border-dashed border-[#CBD5E1] hover:border-[#1F4E5F] rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50"
                >
                  <div className="w-12 h-12 rounded-full bg-[#1F4E5F]/10 flex items-center justify-center text-[#1F4E5F] mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-[#1C2B36] mb-1">
                    Clique para fazer upload do banner principal
                  </p>
                  <p className="text-xs text-[#5B6B76]">
                    Formatos aceitos: JPG, PNG, WebP (até 15MB). Se vazio, usa imagem padrão.
                  </p>
                </div>
              )}

              <input
                ref={heroInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleHeroSelect}
                className="hidden"
              />

              {heroPreview && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => heroInputRef.current?.click()}
                    className="text-xs"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Substituir Imagem
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearHero}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Usar padrão do site
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Logo Upload & Size Options */}
          <Card className="rounded-2xl border-[#E2E6E9] shadow-sm">
            <CardHeader className="pb-4 border-b border-[#E2E6E9]">
              <CardTitle className="text-lg font-bold text-[#1C2B36] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#E07A3F]" />
                <span>Logo da Barra Superior</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#5B6B76]">
                Faça o upload do logo da sua imobiliária ou construtora. Ele substituirá o texto
                "Visita Virtual" na barra de navegação do site.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Logo Upload Box */}
              <div>
                <Label className="text-sm font-semibold text-[#1C2B36] mb-2 block">
                  Arquivo do Logo
                </Label>

                {logoPreview ? (
                  <div className="border border-[#E2E6E9] rounded-xl p-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-2 rounded-lg border border-[#E2E6E9] flex items-center justify-center min-w-28 min-h-20 max-w-48">
                        <img
                          src={logoPreview}
                          alt="Pré-visualização do Logo"
                          className={settingsService.getLogoSizeClass(logoSize)}
                        />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1C2B36]">
                          {logoFile ? logoFile.name : 'Logo configurado'}
                        </div>
                        <div className="text-[11px] text-[#5B6B76]">
                          Fundo transparente (PNG/SVG) é ideal para barra superior.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                        className="text-xs"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" />
                        Trocar Logo
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearLogo}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="border-2 border-dashed border-[#CBD5E1] hover:border-[#1F4E5F] rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#1F4E5F]/10 flex items-center justify-center text-[#1F4E5F] mb-2">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-[#1C2B36] mb-0.5">
                      Clique para fazer upload do seu logo
                    </p>
                    <p className="text-[11px] text-[#5B6B76]">
                      PNG transparente ou SVG recomendado (até 10MB). Se não enviar, exibe o nome
                      "Visita Virtual".
                    </p>
                  </div>
                )}

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  onChange={handleLogoSelect}
                  className="hidden"
                />
              </div>

              {/* Logo Size Selector - Requirement 3 */}
              <div className="pt-2 border-t border-[#E2E6E9]">
                <Label className="text-sm font-semibold text-[#1C2B36] mb-1 block">
                  Tamanho do Logo na Barra Superior
                </Label>
                <p className="text-xs text-[#5B6B76] mb-4">
                  Escolha como o logo deve ser dimensionado na barra de navegação:
                </p>

                <RadioGroup
                  value={logoSize}
                  onValueChange={(val) => setLogoSize(val as LogoSize)}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  {/* Pequeno */}
                  <label
                    htmlFor="size-pequeno"
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      logoSize === 'pequeno'
                        ? 'border-[#1F4E5F] bg-[#1F4E5F]/5 ring-1 ring-[#1F4E5F]'
                        : 'border-[#E2E6E9] hover:bg-slate-50'
                    }`}
                  >
                    <RadioGroupItem value="pequeno" id="size-pequeno" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1C2B36]">Pequeno</div>
                      <div className="text-xs text-[#5B6B76] mt-0.5">
                        Altura ~32px (discreto e compacto)
                      </div>
                      <div className="mt-3 h-8 bg-slate-200/80 rounded flex items-center justify-center text-[10px] text-slate-600 font-medium px-2">
                        Exemplo 32px
                      </div>
                    </div>
                  </label>

                  {/* Médio */}
                  <label
                    htmlFor="size-medio"
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      logoSize === 'medio'
                        ? 'border-[#1F4E5F] bg-[#1F4E5F]/5 ring-1 ring-[#1F4E5F]'
                        : 'border-[#E2E6E9] hover:bg-slate-50'
                    }`}
                  >
                    <RadioGroupItem value="size-medio" id="size-medio" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1C2B36]">Médio</div>
                      <div className="text-xs text-[#5B6B76] mt-0.5">
                        Altura ~48px (padrão equilibrado)
                      </div>
                      <div className="mt-3 h-12 bg-slate-200/80 rounded flex items-center justify-center text-[10px] text-slate-600 font-medium px-2">
                        Exemplo 48px
                      </div>
                    </div>
                  </label>

                  {/* Grande */}
                  <label
                    htmlFor="size-grande"
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      logoSize === 'grande'
                        ? 'border-[#1F4E5F] bg-[#1F4E5F]/5 ring-1 ring-[#1F4E5F]'
                        : 'border-[#E2E6E9] hover:bg-slate-50'
                    }`}
                  >
                    <RadioGroupItem value="size-grande" id="size-grande" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1C2B36]">Grande</div>
                      <div className="text-xs text-[#5B6B76] mt-0.5">
                        Altura ~72px (destaque para marcas horizontais)
                      </div>
                      <div className="mt-3 h-16 bg-slate-200/80 rounded flex items-center justify-center text-[10px] text-slate-600 font-medium px-2">
                        Exemplo 72px
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-[#E2E6E9] space-y-2">
                <div className="text-xs font-semibold text-[#1C2B36] flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Prévia em tempo real de como aparecerá na barra:</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-[#E2E6E9] flex items-center gap-3">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo Preview"
                      className={settingsService.getLogoSizeClass(logoSize)}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-[#1F4E5F] flex items-center justify-center text-white shadow-sm">
                        <Compass className="w-5 h-5 text-[#E07A3F]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-lg leading-none tracking-tight text-[#1F4E5F]">
                          Visita Virtual
                        </span>
                        <span className="text-[10px] tracking-wider uppercase text-[#5B6B76] font-medium">
                          Imóveis em 360°
                        </span>
                      </div>
                    </div>
                  )}
                  <span className="text-xs text-[#5B6B76] italic ml-auto hidden sm:inline">
                    {logoPreview
                      ? `Exibindo logo com tamanho: ${logoSize}`
                      : 'Exibindo fallback padrão (nenhum logo enviado)'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#1F4E5F] hover:bg-[#18404E] text-white px-8 py-5 text-sm font-semibold rounded-xl shadow-md"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2" />
                  Salvando Alterações...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Personalização
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
