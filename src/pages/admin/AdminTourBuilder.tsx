import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { propertiesService } from '@/services/properties'
import { roomsService } from '@/services/rooms'
import { hotspotsService } from '@/services/hotspots'
import { authService } from '@/services/auth'
import type { Property, Room, Hotspot } from '@/types'
import { getRoomPanoramaUrl } from '@/lib/panorama-assets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Compass,
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  UploadCloud,
  ChevronRight,
  ExternalLink,
  MapPin,
  MoveRight,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminTourBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [property, setProperty] = useState<Property | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [loading, setLoading] = useState(true)

  // Connection mode toggle
  const [connectionMode, setConnectionMode] = useState(true)

  // Add/Edit Room Modal
  const [roomModalOpen, setRoomModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [roomName, setRoomName] = useState('')
  const [roomDescription, setRoomDescription] = useState('')
  const [roomDimensions, setRoomDimensions] = useState('')
  const [panoramaFile, setPanoramaFile] = useState<File | null>(null)
  const [isSavingRoom, setIsSavingRoom] = useState(false)

  // Add Hotspot Modal
  const [hotspotModalOpen, setHotspotModalOpen] = useState(false)
  const [selectedSourceRoom, setSelectedSourceRoom] = useState<Room | null>(null)
  const [targetRoomId, setTargetRoomId] = useState('')
  const [hotspotDirection, setHotspotDirection] = useState<number>(0)
  const [isSavingHotspot, setIsSavingHotspot] = useState(false)

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/admin')
      return
    }
    if (id) {
      loadData(id)
    }
  }, [id, navigate])

  const loadData = async (propId: string) => {
    try {
      setLoading(true)
      const prop = await propertiesService.getPropertyById(propId)
      setProperty(prop)

      const rms = await roomsService.getRoomsByProperty(propId)
      setRooms(rms)

      const roomIds = rms.map((r) => r.id)
      const hs = await hotspotsService.getHotspotsForRooms(roomIds)
      setHotspots(hs)
    } catch (err: any) {
      toast.error('Erro ao carregar dados do tour: ' + (err?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  // Open Room Modal
  const handleOpenAddRoom = () => {
    setEditingRoom(null)
    setRoomName('')
    setRoomDescription('')
    setRoomDimensions('')
    setPanoramaFile(null)
    setRoomModalOpen(true)
  }

  const handleOpenEditRoom = (room: Room) => {
    setEditingRoom(room)
    setRoomName(room.name)
    setRoomDescription(room.description || '')
    setRoomDimensions(room.dimensions || '')
    setPanoramaFile(null)
    setRoomModalOpen(true)
  }

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !roomName.trim()) {
      toast.error('O nome do ambiente é obrigatório.')
      return
    }

    try {
      setIsSavingRoom(true)
      const formData = new FormData()
      formData.append('property', id)
      formData.append('name', roomName.trim())
      formData.append('description', roomDescription.trim())
      formData.append('dimensions', roomDimensions.trim())

      if (panoramaFile) {
        formData.append('panorama_image', panoramaFile)
      }

      if (editingRoom) {
        const updated = await roomsService.updateRoom(editingRoom.id, formData)
        setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        toast.success(`Ambiente "${updated.name}" atualizado!`)
      } else {
        const created = await roomsService.createRoom(formData)
        setRooms((prev) => [...prev, created])
        toast.success(`Ambiente "${created.name}" adicionado!`)
      }

      setRoomModalOpen(false)
    } catch (err: any) {
      toast.error('Erro ao salvar ambiente: ' + (err?.message || ''))
    } finally {
      setIsSavingRoom(false)
    }
  }

  const handleDeleteRoom = async (roomId: string, name: string) => {
    if (
      !confirm(
        `Deseja excluir o ambiente "${name}"? Os hotspots conectados também serão removidos.`,
      )
    ) {
      return
    }
    try {
      await roomsService.deleteRoom(roomId)
      setRooms((prev) => prev.filter((r) => r.id !== roomId))
      setHotspots((prev) => prev.filter((h) => h.room !== roomId && h.target_room !== roomId))
      toast.success('Ambiente excluído.')
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err?.message || ''))
    }
  }

  // Open Hotspot Modal
  const handleOpenAddHotspot = (sourceRoom: Room) => {
    setSelectedSourceRoom(sourceRoom)
    const availableTargets = rooms.filter((r) => r.id !== sourceRoom.id)
    setTargetRoomId(availableTargets[0]?.id || '')
    setHotspotDirection(0)
    setHotspotModalOpen(true)
  }

  const handleSaveHotspot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSourceRoom || !targetRoomId) {
      toast.error('Selecione o ambiente de destino.')
      return
    }

    try {
      setIsSavingHotspot(true)
      const created = await hotspotsService.createHotspot({
        room: selectedSourceRoom.id,
        target_room: targetRoomId,
        direction: Math.round(Number(hotspotDirection)) % 360,
      })

      // Expand manually or reload
      const targetRoom = rooms.find((r) => r.id === targetRoomId)
      const createdWithExpand: Hotspot = {
        ...created,
        expand: {
          target_room: targetRoom,
        },
      }

      setHotspots((prev) => [...prev, createdWithExpand])
      toast.success('Conexão criada com sucesso!')
      setHotspotModalOpen(false)
    } catch (err: any) {
      toast.error('Erro ao criar conexão: ' + (err?.message || ''))
    } finally {
      setIsSavingHotspot(false)
    }
  }

  const handleDeleteHotspot = async (hotspotId: string) => {
    try {
      await hotspotsService.deleteHotspot(hotspotId)
      setHotspots((prev) => prev.filter((h) => h.id !== hotspotId))
      toast.success('Conexão removida.')
    } catch (err: any) {
      toast.error('Erro ao excluir conexão: ' + (err?.message || ''))
    }
  }

  if (loading || !property) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center bg-white rounded-2xl border border-[#E2E6E9]">
        <div className="w-8 h-8 border-4 border-[#1F4E5F]/30 border-t-[#1F4E5F] rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-[#5B6B76]">Carregando montador de tour...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E2E6E9] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-[#5B6B76] hover:text-[#1C2B36] p-0 h-auto"
            >
              <Link to="/admin/imoveis" className="flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar aos imóveis</span>
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-[#1C2B36] flex items-center gap-2">
            <Compass className="w-6 h-6 text-[#E07A3F]" />
            <span>Montador de Tour 360° — {property.title}</span>
          </h1>
          <p className="text-xs text-[#5B6B76] mt-0.5">
            {property.neighborhood}, {property.city} • {rooms.length} ambientes cadastrados
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            asChild
            className="bg-[#E07A3F] hover:bg-[#d06d33] text-white text-xs font-semibold shadow-sm"
          >
            <Link to={`/visita/${property.id}`} target="_blank">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Testar Tour 360°
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Overview & Right Rooms Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Property Overview */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-[#E2E6E9] shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-[#F7F5F2] border-b border-[#E2E6E9] pb-4">
              <CardTitle className="text-base font-bold text-[#1C2B36]">
                Visão Geral do Imóvel
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#5B6B76] font-bold block">
                  Status
                </span>
                <span className="text-sm font-semibold text-[#1C2B36]">
                  {property.published
                    ? 'Publicado no portal'
                    : 'Rascunho (não visível publicamente)'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#5B6B76] font-bold block">
                  Planta Baixa
                </span>
                {property.floor_plan_image ? (
                  <div className="mt-2 rounded-xl overflow-hidden border border-[#E2E6E9]">
                    <img
                      src={propertiesService.getFileUrl(property, property.floor_plan_image)}
                      alt="Planta"
                      className="w-full h-auto object-contain"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-[#5B6B76] mt-1 block">
                    Nenhuma imagem de planta enviada (usa planta interativa gerada automaticamente).
                  </span>
                )}
              </div>

              <div className="pt-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full border-[#E2E6E9] text-xs"
                >
                  <Link to={`/admin/imoveis/${property.id}/editar`}>
                    Editar informações do imóvel
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Guide */}
          <Card className="border-[#E2E6E9] shadow-sm bg-white rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-[#1F4E5F] font-bold text-sm mb-2">
                <HelpCircle className="w-4 h-4 text-[#E07A3F]" />
                <span>Como funciona o tour 360°</span>
              </div>
              <ul className="text-xs text-[#5B6B76] space-y-2 list-disc pl-4 leading-relaxed">
                <li>
                  Adicione cada cômodo do imóvel com sua respectiva foto panorâmica equiretangular.
                </li>
                <li>
                  No modo de conexão, aponte as <strong>Saídas (Hotspots)</strong>: escolha para
                  qual cômodo a porta leva e a direção em graus (0° a 360°).
                </li>
                <li>
                  O visitante clica no anel pulsante sobre a porta para navegar sem interrupções!
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Rooms & Hotspots Manager */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[#E2E6E9] shadow-sm bg-white rounded-2xl">
            <CardHeader className="border-b border-[#E2E6E9] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-[#1C2B36]">
                  Ambientes da Visita ({rooms.length})
                </CardTitle>
                <CardDescription className="text-xs text-[#5B6B76]">
                  Configure os cômodos e as conexões entre eles
                </CardDescription>
              </div>

              {/* Mode Toggle: Modo de conexão entre ambientes */}
              <div className="flex items-center gap-2 bg-[#F7F5F2] px-3 py-1.5 rounded-xl border border-[#E2E6E9]">
                <span className="text-xs font-semibold text-[#1C2B36]">
                  Modo de conexão entre ambientes
                </span>
                <Switch checked={connectionMode} onCheckedChange={setConnectionMode} />
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Rooms List */}
              {rooms.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-[#E2E6E9] rounded-2xl">
                  <Compass className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-[#1C2B36]">
                    Nenhum ambiente adicionado ainda
                  </p>
                  <p className="text-xs text-[#5B6B76] mb-4">
                    Adicione a sala, quartos, cozinha e áreas externas.
                  </p>
                  <Button onClick={handleOpenAddRoom} className="bg-[#1F4E5F] text-white text-xs">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Adicionar Primeiro Ambiente
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {rooms.map((room) => {
                    const thumbUrl = room.panorama_image
                      ? roomsService.getFileUrl(room, room.panorama_image)
                      : getRoomPanoramaUrl(room.name)

                    // Hotspots leaving this room
                    const outgoing = hotspots.filter((h) => h.room === room.id)

                    return (
                      <div
                        key={room.id}
                        className="p-4 rounded-2xl border border-[#E2E6E9] bg-white hover:border-[#1F4E5F]/30 transition-all shadow-sm"
                      >
                        {/* Room Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-20 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-[#E2E6E9]">
                              <img
                                src={thumbUrl}
                                alt={room.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-[#1C2B36]">{room.name}</h4>
                              {room.dimensions && (
                                <span className="text-xs text-[#5B6B76] block">
                                  {room.dimensions}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditRoom(room)}
                              className="text-xs text-[#1F4E5F] hover:bg-[#1F4E5F]/10"
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRoom(room.id, room.name)}
                              className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Connection Mode Outgoing Hotspots */}
                        {connectionMode && (
                          <div className="mt-4 pt-3 border-t border-[#E2E6E9]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-[#1F4E5F] flex items-center gap-1.5">
                                <MoveRight className="w-3.5 h-3.5 text-[#E07A3F]" />
                                <span>Saídas / Portas Conectadas ({outgoing.length})</span>
                              </span>

                              {rooms.length > 1 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenAddHotspot(room)}
                                  className="h-7 text-xs border-[#1F4E5F] text-[#1F4E5F] hover:bg-[#1F4E5F] hover:text-white"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Nova Conexão
                                </Button>
                              )}
                            </div>

                            {outgoing.length === 0 ? (
                              <p className="text-[11px] text-[#5B6B76] italic bg-[#F7F5F2] p-2.5 rounded-lg">
                                Nenhuma conexão saindo deste cômodo. Adicione uma porta para outro
                                ambiente.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {outgoing.map((hs) => {
                                  const target =
                                    hs.expand?.target_room ||
                                    rooms.find((r) => r.id === hs.target_room)

                                  return (
                                    <div
                                      key={hs.id}
                                      className="flex items-center justify-between bg-[#F7F5F2] border border-[#E2E6E9] rounded-xl px-3 py-2 text-xs"
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <div className="w-5 h-5 rounded-full bg-[#E07A3F] text-white flex items-center justify-center font-bold text-[9px]">
                                          {hs.direction}°
                                        </div>
                                        <span className="font-semibold text-[#1C2B36] truncate">
                                          {target?.name || 'Ambiente'}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleDeleteHotspot(hs.id)}
                                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                        title="Excluir saída"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add Room Button */}
              <Button
                onClick={handleOpenAddRoom}
                className="w-full bg-[#1F4E5F] hover:bg-[#18404E] text-white font-semibold py-5 rounded-xl shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Novo Ambiente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add / Edit Room Modal */}
      <Dialog open={roomModalOpen} onOpenChange={setRoomModalOpen}>
        <DialogContent className="sm:max-w-md bg-white text-[#1C2B36] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingRoom ? 'Editar Ambiente' : 'Adicionar Ambiente'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveRoom} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="rname" className="text-xs font-semibold">
                Nome do Ambiente *
              </Label>
              <Input
                id="rname"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Ex: Sala de Estar, Suíte Master, Cozinha..."
                className="text-sm rounded-xl border-[#E2E6E9]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rdims" className="text-xs font-semibold">
                Dimensões (opcional)
              </Label>
              <Input
                id="rdims"
                value={roomDimensions}
                onChange={(e) => setRoomDimensions(e.target.value)}
                placeholder="Ex: 6.5m x 4.2m (27m²)"
                className="text-sm rounded-xl border-[#E2E6E9]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rdesc" className="text-xs font-semibold">
                Descrição do Ambiente (opcional)
              </Label>
              <Textarea
                id="rdesc"
                rows={3}
                value={roomDescription}
                onChange={(e) => setRoomDescription(e.target.value)}
                placeholder="Detalhes dos acabamentos, vista, iluminação..."
                className="text-sm rounded-xl border-[#E2E6E9]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Foto Panorâmica 360° (Equiretangular JPG/PNG)
              </Label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#E2E6E9] hover:border-[#1F4E5F] rounded-xl p-4 cursor-pointer bg-slate-50 transition-colors">
                <UploadCloud className="w-5 h-5 text-[#1F4E5F] mb-1" />
                <span className="text-xs text-[#1C2B36] font-medium text-center">
                  {panoramaFile ? panoramaFile.name : 'Clique para selecionar foto 360°'}
                </span>
                <span className="text-[10px] text-[#5B6B76] mt-0.5">
                  (Se omitido, usa panorama demo realista de demonstração)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setPanoramaFile(e.target.files[0])
                    }
                  }}
                />
              </label>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoomModalOpen(false)}
                disabled={isSavingRoom}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingRoom} className="bg-[#1F4E5F] text-white">
                {isSavingRoom ? 'Salvando...' : 'Salvar Ambiente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Hotspot Modal with Direction Picker */}
      <Dialog open={hotspotModalOpen} onOpenChange={setHotspotModalOpen}>
        <DialogContent className="sm:max-w-md bg-white text-[#1C2B36] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Nova Saída / Conexão 360°</DialogTitle>
            <p className="text-xs text-[#5B6B76]">
              Origem: <strong>{selectedSourceRoom?.name}</strong>
            </p>
          </DialogHeader>

          <form onSubmit={handleSaveHotspot} className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ambiente de Destino</Label>
              <Select value={targetRoomId} onValueChange={setTargetRoomId}>
                <SelectTrigger className="rounded-xl border-[#E2E6E9]">
                  <SelectValue placeholder="Selecione o ambiente" />
                </SelectTrigger>
                <SelectContent>
                  {rooms
                    .filter((r) => r.id !== selectedSourceRoom?.id)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Visual Direction Compass / Circle Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Direção no Panorama 360°: {hotspotDirection}°
                </Label>
                <span className="text-[11px] text-[#5B6B76]">
                  {hotspotDirection === 0 && 'Norte (Frente)'}
                  {hotspotDirection > 0 && hotspotDirection < 90 && 'Nordeste'}
                  {hotspotDirection === 90 && 'Leste (Direita)'}
                  {hotspotDirection > 90 && hotspotDirection < 180 && 'Sudeste'}
                  {hotspotDirection === 180 && 'Sul (Costas)'}
                  {hotspotDirection > 180 && hotspotDirection < 270 && 'Sudoeste'}
                  {hotspotDirection === 270 && 'Oeste (Esquerda)'}
                  {hotspotDirection > 270 && hotspotDirection < 360 && 'Noroeste'}
                </span>
              </div>

              {/* Circular Compass Visual Picker */}
              <div className="flex items-center justify-center py-4 bg-[#F7F5F2] rounded-2xl border border-[#E2E6E9]">
                <div
                  className="relative w-36 h-36 rounded-full border-2 border-[#1F4E5F] flex items-center justify-center cursor-pointer select-none bg-white shadow-inner"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const cx = rect.left + rect.width / 2
                    const cy = rect.top + rect.height / 2
                    const dx = e.clientX - cx
                    const dy = e.clientY - cy
                    // angle in degrees: 0 is North (top)
                    let deg = Math.round(Math.atan2(dx, -dy) * (180 / Math.PI))
                    if (deg < 0) deg += 360
                    setHotspotDirection(deg)
                  }}
                >
                  <span className="absolute top-1 text-[10px] font-bold text-[#1F4E5F]">0° N</span>
                  <span className="absolute right-1 text-[10px] font-bold text-[#1F4E5F]">
                    90° L
                  </span>
                  <span className="absolute bottom-1 text-[10px] font-bold text-[#1F4E5F]">
                    180° S
                  </span>
                  <span className="absolute left-1 text-[10px] font-bold text-[#1F4E5F]">
                    270° O
                  </span>

                  {/* Compass needle pointing to selected direction */}
                  <div
                    className="absolute w-1 h-14 bg-gradient-to-t from-transparent to-[#E07A3F] origin-bottom rounded transition-transform duration-100"
                    style={{
                      bottom: '50%',
                      transform: `rotate(${hotspotDirection}deg)`,
                    }}
                  >
                    <div className="w-2.5 h-2.5 -top-1 -left-[3px] bg-[#E07A3F] rounded-full absolute shadow-sm" />
                  </div>
                  <div className="w-3 h-3 bg-[#1F4E5F] rounded-full z-10" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={hotspotDirection}
                  onChange={(e) => setHotspotDirection(Number(e.target.value))}
                  className="w-full accent-[#E07A3F]"
                />
                <Input
                  type="number"
                  min="0"
                  max="359"
                  value={hotspotDirection}
                  onChange={(e) => setHotspotDirection(Number(e.target.value))}
                  className="w-20 text-center rounded-xl border-[#E2E6E9]"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setHotspotModalOpen(false)}
                disabled={isSavingHotspot}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingHotspot} className="bg-[#1F4E5F] text-white">
                {isSavingHotspot ? 'Criando...' : 'Salvar Conexão'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
