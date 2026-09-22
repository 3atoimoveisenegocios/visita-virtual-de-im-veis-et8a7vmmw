import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { propertiesService } from '@/services/properties'
import { authService } from '@/services/auth'
import type { Property } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, Save, Building2, UploadCloud, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminPropertyForm() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(isEditing)

  // Form Fields
  const [title, setTitle] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('São Paulo')
  const [price, setPrice] = useState<number | ''>('')
  const [areaM2, setAreaM2] = useState<number | ''>('')
  const [bedrooms, setBedrooms] = useState<number | ''>('')
  const [bathrooms, setBathrooms] = useState<number | ''>('')
  const [parkingSpots, setParkingSpots] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('5511999998888')
  const [published, setPublished] = useState(true)
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null)
  const [existingFloorPlan, setExistingFloorPlan] = useState('')

  // Field errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/admin')
      return
    }

    if (isEditing && id) {
      loadProperty(id)
    }
  }, [id, isEditing, navigate])

  const loadProperty = async (propId: string) => {
    try {
      setInitialLoading(true)
      const prop = await propertiesService.getPropertyById(propId)
      setTitle(prop.title || '')
      setNeighborhood(prop.neighborhood || '')
      setCity(prop.city || 'São Paulo')
      setPrice(prop.price ?? '')
      setAreaM2(prop.area_m2 ?? '')
      setBedrooms(prop.bedrooms ?? '')
      setBathrooms(prop.bathrooms ?? '')
      setParkingSpots(prop.parking_spots ?? '')
      setDescription(prop.description || '')
      setWhatsappNumber(prop.whatsapp_number || '')
      setPublished(Boolean(prop.published))
      if (prop.floor_plan_image) {
        setExistingFloorPlan(propertiesService.getFileUrl(prop, prop.floor_plan_image))
      }
    } catch (err: any) {
      toast.error('Erro ao carregar dados do imóvel: ' + (err?.message || ''))
      navigate('/admin/imoveis')
    } finally {
      setInitialLoading(false)
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Título é obrigatório'
    if (!neighborhood.trim()) errs.neighborhood = 'Bairro é obrigatório'
    if (!city.trim()) errs.city = 'Cidade é obrigatória'
    if (!price || Number(price) <= 0) errs.price = 'Preço deve ser maior que zero'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      toast.error('Por favor, preencha os campos obrigatórios.')
      return
    }

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('neighborhood', neighborhood.trim())
      formData.append('city', city.trim())
      formData.append('price', String(price))
      if (areaM2) formData.append('area_m2', String(areaM2))
      if (bedrooms) formData.append('bedrooms', String(bedrooms))
      if (bathrooms) formData.append('bathrooms', String(bathrooms))
      if (parkingSpots) formData.append('parking_spots', String(parkingSpots))
      formData.append('description', description.trim())
      formData.append('whatsapp_number', whatsappNumber.trim())
      formData.append('published', String(published))

      if (floorPlanFile) {
        formData.append('floor_plan_image', floorPlanFile)
      }

      if (isEditing && id) {
        await propertiesService.updateProperty(id, formData)
        toast.success('Imóvel salvo com sucesso')
      } else {
        const created = await propertiesService.createProperty(formData)
        toast.success('Imóvel salvo com sucesso')
        // If creating new, optionally prompt to build tour
        navigate(`/admin/imoveis/${created.id}/tour`)
        return
      }

      navigate('/admin/imoveis')
    } catch (err: any) {
      console.error('Erro ao salvar imóvel:', err)
      // PocketBase field-level errors
      if (err?.data?.data) {
        const backendErrors: Record<string, string> = {}
        for (const [key, val] of Object.entries(err.data.data)) {
          backendErrors[key] = (val as any)?.message || 'Inválido'
        }
        setErrors(backendErrors)
      }
      toast.error('Erro ao salvar imóvel: ' + (err?.message || 'Verifique os dados'))
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center bg-white rounded-2xl border border-[#E2E6E9]">
        <div className="w-8 h-8 border-4 border-[#1F4E5F]/30 border-t-[#1F4E5F] rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-[#5B6B76]">Carregando dados do imóvel...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="text-[#5B6B76] hover:text-[#1C2B36]">
          <Link to="/admin/imoveis" className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para lista de imóveis</span>
          </Link>
        </Button>
      </div>

      <Card className="border-[#E2E6E9] shadow-sm bg-white rounded-2xl">
        <CardHeader className="border-b border-[#E2E6E9] pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-[#1C2B36]">
                {isEditing ? 'Editar Imóvel' : 'Cadastrar Novo Imóvel'}
              </CardTitle>
              <CardDescription className="text-xs text-[#5B6B76]">
                Preencha os dados do imóvel para a apresentação pública e tour virtual
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-semibold text-[#1C2B36]">
                Título do Imóvel *
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Apartamento de Luxo nos Jardins com Varanda Gourmet"
                className={`text-sm rounded-xl ${errors.title ? 'border-red-500' : 'border-[#E2E6E9]'}`}
                required
              />
              {errors.title && <span className="text-xs text-red-500">{errors.title}</span>}
            </div>

            {/* Neighborhood & City & Price */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="neighborhood" className="text-xs font-semibold text-[#1C2B36]">
                  Bairro *
                </Label>
                <Input
                  id="neighborhood"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Ex: Jardins"
                  className={`text-sm rounded-xl ${errors.neighborhood ? 'border-red-500' : 'border-[#E2E6E9]'}`}
                  required
                />
                {errors.neighborhood && (
                  <span className="text-xs text-red-500">{errors.neighborhood}</span>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs font-semibold text-[#1C2B36]">
                  Cidade *
                </Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: São Paulo"
                  className={`text-sm rounded-xl ${errors.city ? 'border-red-500' : 'border-[#E2E6E9]'}`}
                  required
                />
                {errors.city && <span className="text-xs text-red-500">{errors.city}</span>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="price" className="text-xs font-semibold text-[#1C2B36]">
                  Preço de Venda (R$) *
                </Label>
                <Input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ex: 1500000"
                  className={`text-sm rounded-xl ${errors.price ? 'border-red-500' : 'border-[#E2E6E9]'}`}
                  required
                />
                {errors.price && <span className="text-xs text-red-500">{errors.price}</span>}
              </div>
            </div>

            {/* Area, Bedrooms, Bathrooms, Parking */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="area" className="text-xs font-semibold text-[#1C2B36]">
                  Área Útil (m²)
                </Label>
                <Input
                  id="area"
                  type="number"
                  value={areaM2}
                  onChange={(e) => setAreaM2(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ex: 140"
                  className="text-sm rounded-xl border-[#E2E6E9]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bedrooms" className="text-xs font-semibold text-[#1C2B36]">
                  Quartos
                </Label>
                <Input
                  id="bedrooms"
                  type="number"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ex: 3"
                  className="text-sm rounded-xl border-[#E2E6E9]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bathrooms" className="text-xs font-semibold text-[#1C2B36]">
                  Banheiros
                </Label>
                <Input
                  id="bathrooms"
                  type="number"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ex: 2"
                  className="text-sm rounded-xl border-[#E2E6E9]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="parking" className="text-xs font-semibold text-[#1C2B36]">
                  Vagas de Garagem
                </Label>
                <Input
                  id="parking"
                  type="number"
                  value={parkingSpots}
                  onChange={(e) => setParkingSpots(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ex: 2"
                  className="text-sm rounded-xl border-[#E2E6E9]"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-semibold text-[#1C2B36]">
                Descrição Completa
              </Label>
              <Textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva os diferenciais do imóvel, acabamentos, vista, condomínio..."
                className="text-sm rounded-xl border-[#E2E6E9] leading-relaxed"
              />
            </div>

            {/* WhatsApp Link / Number */}
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp" className="text-xs font-semibold text-[#1C2B36]">
                Número de WhatsApp para Contato (com DDD)
              </Label>
              <Input
                id="whatsapp"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="Ex: 5511999998888"
                className="text-sm rounded-xl border-[#E2E6E9]"
              />
              <span className="text-[11px] text-[#5B6B76]">
                Usado para criar o link wa.me direto com o visitante interessado.
              </span>
            </div>

            {/* Floor Plan Upload */}
            <div className="space-y-2 pt-2 border-t border-[#E2E6E9]">
              <Label className="text-xs font-semibold text-[#1C2B36] flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-[#1F4E5F]" />
                <span>Imagem da Planta do Imóvel (opcional)</span>
              </Label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <label className="flex-1 w-full flex flex-col items-center justify-center border-2 border-dashed border-[#E2E6E9] hover:border-[#1F4E5F] rounded-2xl p-4 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <UploadCloud className="w-6 h-6 text-[#1F4E5F] mb-1" />
                  <span className="text-xs font-medium text-[#1C2B36]">
                    {floorPlanFile
                      ? floorPlanFile.name
                      : 'Selecionar imagem da planta (JPG, PNG, SVG)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFloorPlanFile(e.target.files[0])
                      }
                    }}
                  />
                </label>

                {/* Preview existing or selected */}
                {(floorPlanFile || existingFloorPlan) && (
                  <div className="w-24 h-24 rounded-xl border border-[#E2E6E9] overflow-hidden bg-white p-1 flex-shrink-0 flex items-center justify-center">
                    <img
                      src={floorPlanFile ? URL.createObjectURL(floorPlanFile) : existingFloorPlan}
                      alt="Preview Planta"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Published Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#F7F5F2] border border-[#E2E6E9]">
              <div>
                <Label
                  htmlFor="published-toggle"
                  className="text-sm font-bold text-[#1C2B36] block"
                >
                  Publicar Imóvel no Portal
                </Label>
                <p className="text-xs text-[#5B6B76]">
                  Se desativado, o imóvel fica como rascunho e não aparece na listagem pública.
                </p>
              </div>
              <Switch id="published-toggle" checked={published} onCheckedChange={setPublished} />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                asChild
                type="button"
                variant="outline"
                className="border-[#E2E6E9] text-[#1C2B36]"
              >
                <Link to="/admin/imoveis">Cancelar</Link>
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#1F4E5F] hover:bg-[#18404E] text-white font-semibold px-6 shadow-sm"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Salvando...' : 'Salvar Imóvel'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
