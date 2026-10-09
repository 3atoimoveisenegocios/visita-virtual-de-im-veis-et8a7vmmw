import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { propertiesService } from '@/services/properties'
import { roomsService } from '@/services/rooms'
import { authService } from '@/services/auth'
import type { Property, Room } from '@/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  PlusCircle,
  Edit,
  Trash2,
  Compass,
  ExternalLink,
  Building2,
  MapPin,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { EmbedCodeButton } from '@/components/admin/EmbedCodeButton'

export default function AdminPropertiesList() {
  const navigate = useNavigate()
  const [properties, setProperties] = useState<Property[]>([])
  const [roomsMap, setRoomsMap] = useState<Record<string, Room[]>>({})
  const [loading, setLoading] = useState(true)

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/admin')
      return
    }
    loadProperties()
  }, [navigate])

  const loadProperties = async () => {
    try {
      setLoading(true)
      const props = await propertiesService.getAllProperties()
      setProperties(props)

      const rMap: Record<string, Room[]> = {}
      for (const p of props) {
        const rms = await roomsService.getRoomsByProperty(p.id)
        rMap[p.id] = rms
      }
      setRoomsMap(rMap)
    } catch (err: any) {
      toast.error('Erro ao carregar imóveis: ' + (err?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePublish = async (property: Property, checked: boolean) => {
    try {
      await propertiesService.togglePublish(property.id, checked)
      setProperties((prev) =>
        prev.map((p) => (p.id === property.id ? { ...p, published: checked } : p)),
      )
      toast.success(
        checked
          ? `Imóvel "${property.title}" publicado no portal!`
          : `Imóvel "${property.title}" despublicado.`,
      )
    } catch (err: any) {
      toast.error('Erro ao atualizar status: ' + (err?.message || ''))
    }
  }

  const confirmDelete = async () => {
    if (!propertyToDelete) return
    try {
      setIsDeleting(true)
      await propertiesService.deleteProperty(propertyToDelete.id)
      setProperties((prev) => prev.filter((p) => p.id !== propertyToDelete.id))
      toast.success('Imóvel excluído com sucesso.')
      setDeleteModalOpen(false)
      setPropertyToDelete(null)
    } catch (err: any) {
      toast.error('Erro ao excluir imóvel: ' + (err?.message || ''))
    } finally {
      setIsDeleting(false)
    }
  }

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E2E6E9] shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2B36] flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#1F4E5F]" />
            <span>Gestão de Imóveis & Tours</span>
          </h1>
          <p className="text-xs text-[#5B6B76] mt-1">
            Gerencie os imóveis cadastrados, monte as conexões 360° e publique as visitas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="border-[#E2E6E9] text-[#1C2B36]">
            <Link to="/admin/aparencia" className="flex items-center gap-2">
              <span>Personalizar Banner & Logo</span>
            </Link>
          </Button>
          <Button asChild className="bg-[#1F4E5F] hover:bg-[#18404E] text-white">
            <Link to="/admin/imoveis/novo" className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4" />
              <span>Novo Imóvel</span>
            </Link>
          </Button>
        </div>
      </div>
      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#E2E6E9]">
          <div className="w-8 h-8 border-4 border-[#1F4E5F]/30 border-t-[#1F4E5F] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#5B6B76]">Carregando catálogo...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && properties.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#E2E6E9] shadow-sm">
          <Building2 className="w-12 h-12 text-[#5B6B76]/40 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[#1C2B36] mb-1">Nenhum imóvel cadastrado ainda</h3>
          <p className="text-xs text-[#5B6B76] mb-6">
            Comece cadastrando o primeiro imóvel para montar o tour virtual 360°.
          </p>
          <Button asChild className="bg-[#1F4E5F] text-white">
            <Link to="/admin/imoveis/novo">Cadastrar Primeiro Imóvel</Link>
          </Button>
        </div>
      )}

      {/* Properties List */}
      {!loading && properties.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {properties.map((prop) => {
            const rms = roomsMap[prop.id] || []
            const firstRoom = rms[0]
            const coverUrl = prop.cover_image
              ? propertiesService.getFileUrl(prop, prop.cover_image)
              : firstRoom?.panorama_image
                ? propertiesService.getFileUrl(firstRoom, firstRoom.panorama_image)
                : 'https://pannellum.org/images/alma.jpg'

            return (
              <div
                key={prop.id}
                className="bg-white rounded-2xl border border-[#E2E6E9] p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Left: Thumbnail + Title + Meta */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-24 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 relative border border-[#E2E6E9]">
                    <img src={coverUrl} alt={prop.title} className="w-full h-full object-cover" />
                    <div className="absolute top-1 left-1 bg-black/60 rounded px-1.5 py-0.5 text-[9px] text-white font-semibold">
                      {rms.length} {rms.length === 1 ? 'ambiente' : 'ambientes'}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-base text-[#1C2B36] truncate">{prop.title}</h3>
                      {prop.published ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold py-0">
                          Publicado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 text-[10px] py-0">
                          Rascunho
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#5B6B76] mb-1">
                      <MapPin className="w-3.5 h-3.5 text-[#E07A3F]" />
                      <span>
                        {prop.neighborhood}, {prop.city}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-[#1F4E5F]">
                        {formatPrice(prop.price)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#5B6B76]">
                      {prop.bedrooms ? <span>{prop.bedrooms} quartos</span> : null}
                      {prop.area_m2 ? <span>{prop.area_m2} m²</span> : null}
                    </div>
                  </div>
                </div>

                {/* Right: Publish switch + Action buttons */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-[#E2E6E9]">
                  {/* Publish Switch */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#5B6B76] font-medium hidden sm:inline">
                      {prop.published ? 'No ar' : 'Oculto'}
                    </span>
                    <Switch
                      checked={prop.published}
                      onCheckedChange={(checked) => handleTogglePublish(prop, checked)}
                      aria-label="Publicar imóvel"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      asChild
                      size="sm"
                      className="bg-[#E07A3F] hover:bg-[#d06d33] text-white text-xs font-semibold"
                    >
                      <Link to={`/admin/imoveis/${prop.id}/tour`}>
                        <Compass className="w-3.5 h-3.5 mr-1.5" />
                        Montar Tour
                      </Link>
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="border-[#E2E6E9] text-[#1C2B36] hover:bg-slate-100 text-xs"
                    >
                      <Link to={`/admin/imoveis/${prop.id}/editar`}>
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        Editar
                      </Link>
                    </Button>

                    <EmbedCodeButton
                      propertyId={prop.id}
                      propertyTitle={prop.title}
                      variant="outline"
                      size="sm"
                      className="border-[#E2E6E9] text-[#1C2B36] hover:bg-slate-100 text-xs"
                      showText={true}
                    />

                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="text-[#1F4E5F] hover:bg-[#1F4E5F]/10 text-xs"
                      title="Abrir Visita Pública"
                    >
                      <Link to={`/visita/${prop.id}`} target="_blank">
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPropertyToDelete(prop)
                        setDeleteModalOpen(true)
                      }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md bg-white text-[#1C2B36] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Excluir Imóvel</DialogTitle>
            <DialogDescription className="text-sm text-[#5B6B76] pt-2">
              Tem certeza que deseja excluir o imóvel <strong>"{propertyToDelete?.title}"</strong>?
              Esta ação não pode ser desfeita e removerá todos os ambientes e conexões 360°
              associados.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Excluindo...' : 'Sim, excluir imóvel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
