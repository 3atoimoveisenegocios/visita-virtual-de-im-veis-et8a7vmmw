import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { propertiesService } from '@/services/properties'
import { roomsService } from '@/services/rooms'
import { navPointsService } from '@/services/navPoints'
import { hotspotsService } from '@/services/hotspots'
import { authService } from '@/services/auth'
import type { Property, Room, NavPoint, Hotspot } from '@/types'
import { getRoomPanoramaUrl, generateDemoFloorPlan } from '@/lib/panorama-assets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Footprints,
  Layers,
  Map as MapIcon,
  Eye,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminTourBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [property, setProperty] = useState<Property | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [navPoints, setNavPoints] = useState<NavPoint[]>([])
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [loading, setLoading] = useState(true)

  // Active view tab: 'rooms' or 'floorplan'
  const [activeTab, setActiveTab] = useState<'rooms' | 'floorplan'>('rooms')

  // Connection mode toggle
  const [connectionMode, setConnectionMode] = useState(true)

  // Add/Edit Room Modal
  const [roomModalOpen, setRoomModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [roomName, setRoomName] = useState('')
  const [roomDescription, setRoomDescription] = useState('')
  const [roomDimensions, setRoomDimensions] = useState('')
  const [roomPanoramaFile, setRoomPanoramaFile] = useState<File | null>(null)
  const [isSavingRoom, setIsSavingRoom] = useState(false)

  // Add/Edit Nav Point Modal
  const [pointModalOpen, setPointModalOpen] = useState(false)
  const [targetRoomForPoint, setTargetRoomForPoint] = useState<Room | null>(null)
  const [editingPoint, setEditingPoint] = useState<NavPoint | null>(null)
  const [pointName, setPointName] = useState('')
  const [pointPanoramaFile, setPointPanoramaFile] = useState<File | null>(null)
  const [pointPosX, setPointPosX] = useState<number>(50)
  const [pointPosY, setPointPosY] = useState<number>(50)
  const [pointIsEntry, setPointIsEntry] = useState(false)
  const [isSavingPoint, setIsSavingPoint] = useState(false)

  // Add Hotspot Modal
  const [hotspotModalOpen, setHotspotModalOpen] = useState(false)
  const [selectedSourceRoom, setSelectedSourceRoom] = useState<Room | null>(null)
  const [selectedSourcePointId, setSelectedSourcePointId] = useState<string>('')
  const [hotspotType, setHotspotType] = useState<'step' | 'door'>('step')
  const [targetRoomId, setTargetRoomId] = useState('')
  const [targetPointId, setTargetPointId] = useState('')
  const [hotspotDirection, setHotspotDirection] = useState<number>(0)
  const [hotspotLabel, setHotspotLabel] = useState('')
  const [isSavingHotspot, setIsSavingHotspot] = useState(false)

  // Floor plan point dragging state
  const floorPlanRef = useRef<HTMLDivElement>(null)
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null)

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
      const [pts, hs] = await Promise.all([
        navPointsService.getNavPointsByRooms(roomIds),
        hotspotsService.getHotspotsForRooms(roomIds),
      ])

      setNavPoints(pts)
      setHotspots(hs)
    } catch (err: any) {
      toast.error('Erro ao carregar dados do tour: ' + (err?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  // ================= ROOM HANDLERS =================
  const handleOpenAddRoom = () => {
    setEditingRoom(null)
    setRoomName('')
    setRoomDescription('')
    setRoomDimensions('')
    setRoomPanoramaFile(null)
    setRoomModalOpen(true)
  }

  const handleOpenEditRoom = (room: Room) => {
    setEditingRoom(room)
    setRoomName(room.name)
    setRoomDescription(room.description || '')
    setRoomDimensions(room.dimensions || '')
    setRoomPanoramaFile(null)
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

      if (roomPanoramaFile) {
        formData.append('panorama_image', roomPanoramaFile)
      }

      if (editingRoom) {
        const updated = await roomsService.updateRoom(editingRoom.id, formData)
        setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        toast.success(`Ambiente "${updated.name}" atualizado!`)
      } else {
        const created = await roomsService.createRoom(formData)
        // Automatically create a default navigation point for this new room
        const pt = await navPointsService.createNavPoint({
          room: created.id,
          name: `Ponto Principal - ${created.name}`,
          is_entry: true,
          pos_x: 50,
          pos_y: 50,
          order: 1,
        })
        setRooms((prev) => [...prev, created])
        setNavPoints((prev) => [...prev, pt])
        toast.success(`Ambiente "${created.name}" criado com ponto inicial!`)
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
        `Deseja excluir o ambiente "${name}"? Todos os pontos e conexões conectados serão removidos.`,
      )
    ) {
      return
    }
    try {
      await roomsService.deleteRoom(roomId)
      setRooms((prev) => prev.filter((r) => r.id !== roomId))
      setNavPoints((prev) => prev.filter((p) => p.room !== roomId))
      setHotspots((prev) => prev.filter((h) => h.room !== roomId && h.target_room !== roomId))
      toast.success('Ambiente excluído.')
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err?.message || ''))
    }
  }

  // ================= NAV POINT HANDLERS =================
  const handleOpenAddPoint = (room: Room) => {
    setTargetRoomForPoint(room)
    setEditingPoint(null)
    setPointName('')
    setPointPanoramaFile(null)
    setPointPosX(50)
    setPointPosY(50)
    setPointIsEntry(false)
    setPointModalOpen(true)
  }

  const handleOpenEditPoint = (point: NavPoint, room: Room) => {
    setTargetRoomForPoint(room)
    setEditingPoint(point)
    setPointName(point.name)
    setPointPanoramaFile(null)
    setPointPosX(point.pos_x ?? 50)
    setPointPosY(point.pos_y ?? 50)
    setPointIsEntry(!!point.is_entry)
    setPointModalOpen(true)
  }

  const handleSavePoint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetRoomForPoint || !pointName.trim()) {
      toast.error('O nome do ponto de navegação é obrigatório.')
      return
    }

    try {
      setIsSavingPoint(true)
      const formData = new FormData()
      formData.append('room', targetRoomForPoint.id)
      formData.append('name', pointName.trim())
      formData.append('pos_x', pointPosX.toString())
      formData.append('pos_y', pointPosY.toString())
      formData.append('is_entry', pointIsEntry ? 'true' : 'false')

      if (pointPanoramaFile) {
        formData.append('panorama_image', pointPanoramaFile)
      }

      if (editingPoint) {
        const updated = await navPointsService.updateNavPoint(editingPoint.id, formData)
        setNavPoints((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        toast.success(`Ponto "${updated.name}" atualizado!`)
      } else {
        const roomPts = navPoints.filter((p) => p.room === targetRoomForPoint.id)
        formData.append('order', (roomPts.length + 1).toString())
        const created = await navPointsService.createNavPoint(formData)
        setNavPoints((prev) => [...prev, created])
        toast.success(`Novo ponto "${created.name}" adicionado ao cômodo!`)
      }

      setPointModalOpen(false)
    } catch (err: any) {
      toast.error('Erro ao salvar ponto: ' + (err?.message || ''))
    } finally {
      setIsSavingPoint(false)
    }
  }

  const handleDeletePoint = async (pointId: string, name: string) => {
    if (!confirm(`Deseja remover o ponto de visão "${name}"?`)) return
    try {
      await navPointsService.deleteNavPoint(pointId)
      setNavPoints((prev) => prev.filter((p) => p.id !== pointId))
      setHotspots((prev) =>
        prev.filter((h) => h.nav_point !== pointId && h.target_nav_point !== pointId),
      )
      toast.success('Ponto removido.')
    } catch (err: any) {
      toast.error('Erro ao excluir ponto: ' + (err?.message || ''))
    }
  }

  // ================= HOTSPOT / CONNECTION HANDLERS =================
  const handleOpenAddHotspot = (sourceRoom: Room, defaultPointId?: string) => {
    setSelectedSourceRoom(sourceRoom)
    const roomPts = navPoints.filter((p) => p.room === sourceRoom.id)
    const sourcePtId = defaultPointId || roomPts[0]?.id || ''
    setSelectedSourcePointId(sourcePtId)

    // Default to 'step' if room has other points, otherwise 'door'
    if (roomPts.length > 1) {
      setHotspotType('step')
      setTargetRoomId(sourceRoom.id)
      const otherPts = roomPts.filter((p) => p.id !== sourcePtId)
      setTargetPointId(otherPts[0]?.id || '')
      setHotspotLabel(otherPts[0]?.name ? `Ir para ${otherPts[0].name}` : '')
    } else {
      setHotspotType('door')
      const otherRooms = rooms.filter((r) => r.id !== sourceRoom.id)
      const firstOtherRoom = otherRooms[0]
      setTargetRoomId(firstOtherRoom?.id || '')
      const targetPts = navPoints.filter((p) => p.room === firstOtherRoom?.id)
      setTargetPointId(targetPts[0]?.id || '')
      setHotspotLabel(firstOtherRoom?.name ? `Ir para ${firstOtherRoom.name}` : '')
    }

    setHotspotDirection(0)
    setHotspotModalOpen(true)
  }

  const handleSaveHotspot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSourceRoom || !targetRoomId) {
      toast.error('Selecione o destino da conexão.')
      return
    }

    try {
      setIsSavingHotspot(true)
      const created = await hotspotsService.createHotspot({
        room: selectedSourceRoom.id,
        target_room: targetRoomId,
        nav_point: selectedSourcePointId || undefined,
        target_nav_point: targetPointId || undefined,
        direction: Math.round(Number(hotspotDirection)) % 360,
        type: hotspotType,
        label: hotspotLabel.trim() || undefined,
      })

      // Expand manually
      const targetRoom = rooms.find((r) => r.id === targetRoomId)
      const sourcePt = navPoints.find((p) => p.id === selectedSourcePointId)
      const targetPt = navPoints.find((p) => p.id === targetPointId)

      const createdWithExpand: Hotspot = {
        ...created,
        expand: {
          room: selectedSourceRoom,
          target_room: targetRoom,
          nav_point: sourcePt,
          target_nav_point: targetPt,
        },
      }

      setHotspots((prev) => [...prev, createdWithExpand])
      toast.success(
        hotspotType === 'step'
          ? 'Seta de deslocamento no mesmo cômodo criada com sucesso!'
          : 'Porta de saída criada com sucesso!',
      )
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

  // ================= FLOOR PLAN DRAG & DROP =================
  const handleFloorPlanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingPointId || !floorPlanRef.current) return
    const rect = floorPlanRef.current.getBoundingClientRect()
    const x = Math.max(5, Math.min(95, Math.round(((e.clientX - rect.left) / rect.width) * 100)))
    const y = Math.max(5, Math.min(95, Math.round(((e.clientY - rect.top) / rect.height) * 100)))

    setNavPoints((prev) =>
      prev.map((p) => (p.id === draggingPointId ? { ...p, pos_x: x, pos_y: y } : p)),
    )
  }

  const handleFloorPlanPointerUp = async () => {
    if (!draggingPointId) return
    const pt = navPoints.find((p) => p.id === draggingPointId)
    setDraggingPointId(null)
    if (pt) {
      try {
        await navPointsService.updateNavPoint(pt.id, {
          pos_x: pt.pos_x,
          pos_y: pt.pos_y,
        })
        toast.success(`Posição de "${pt.name}" na planta atualizada!`)
      } catch (e: any) {
        toast.error('Erro ao atualizar posição na planta: ' + e?.message)
      }
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
            {property.neighborhood}, {property.city} • {rooms.length} cômodos • {navPoints.length}{' '}
            pontos de visão Street View
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
        {/* Left Panel: Property Overview & Quick Guide */}
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
                    Nenhuma imagem enviada (planta interativa gerada automaticamente com os
                    cômodos).
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

          {/* Street View Quick Guide */}
          <Card className="border-[#E2E6E9] shadow-sm bg-white rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-[#1F4E5F] font-bold text-sm mb-2">
                <Footprints className="w-4 h-4 text-[#E07A3F]" />
                <span>Caminhada Estilo Street View</span>
              </div>
              <ul className="text-xs text-[#5B6B76] space-y-2 list-disc pl-4 leading-relaxed">
                <li>
                  <strong>Múltiplos pontos no mesmo cômodo:</strong> Cadastre posições diferentes
                  (ex: <em>Sofá</em>, <em>Mesa de Jantar</em>, <em>Varanda</em>).
                </li>
                <li>
                  <strong>Setas de deslocamento:</strong> Crie conexões do tipo{' '}
                  <em>"Passo interno"</em> apontando a direção no panorama (0° a 360°).
                </li>
                <li>
                  <strong>Posição na planta:</strong> Na aba <em>Planta Interativa</em>, arraste os
                  pontos para a posição exata no mapa.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Tabs for Rooms / Navigation Points & Floor Plan Pinning */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E2E6E9] shadow-sm">
              <TabsList className="bg-[#F7F5F2] p-1 rounded-xl">
                <TabsTrigger
                  value="rooms"
                  className="rounded-lg text-xs font-semibold data-[state=active]:bg-[#1F4E5F] data-[state=active]:text-white"
                >
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                  Ambientes e Pontos 360° ({rooms.length})
                </TabsTrigger>
                <TabsTrigger
                  value="floorplan"
                  className="rounded-lg text-xs font-semibold data-[state=active]:bg-[#1F4E5F] data-[state=active]:text-white"
                >
                  <MapIcon className="w-3.5 h-3.5 mr-1.5" />
                  Posicionamento na Planta
                </TabsTrigger>
              </TabsList>

              {activeTab === 'rooms' && (
                <div className="flex items-center gap-2 bg-[#F7F5F2] px-3 py-1.5 rounded-xl border border-[#E2E6E9]">
                  <span className="text-xs font-semibold text-[#1C2B36]">
                    Exibir conexões e setas
                  </span>
                  <Switch checked={connectionMode} onCheckedChange={setConnectionMode} />
                </div>
              )}
            </div>

            {/* TAB 1: Rooms & Nav Points Manager */}
            <TabsContent value="rooms" className="space-y-4 m-0">
              {rooms.length === 0 ? (
                <Card className="border-[#E2E6E9] shadow-sm bg-white rounded-2xl p-8 text-center border-dashed">
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
                </Card>
              ) : (
                <div className="space-y-4">
                  {rooms.map((room) => {
                    const roomThumb = room.panorama_image
                      ? roomsService.getFileUrl(room, room.panorama_image)
                      : getRoomPanoramaUrl(room.name)
                    const roomPts = navPoints.filter((p) => p.room === room.id)
                    const roomHs = hotspots.filter((h) => h.room === room.id)

                    return (
                      <Card
                        key={room.id}
                        className="border-[#E2E6E9] shadow-sm bg-white rounded-2xl overflow-hidden hover:border-[#1F4E5F]/40 transition-all"
                      >
                        {/* Room Header */}
                        <div className="p-4 bg-white border-b border-[#E2E6E9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-[#E2E6E9]">
                              <img
                                src={roomThumb}
                                alt={room.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-[#1C2B36]">{room.name}</h4>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-[#1F4E5F]/10 text-[#1F4E5F] border-0"
                                >
                                  {roomPts.length} {roomPts.length === 1 ? 'ponto' : 'pontos'}
                                </Badge>
                              </div>
                              {room.dimensions && (
                                <span className="text-xs text-[#5B6B76] block">
                                  {room.dimensions}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAddPoint(room)}
                              className="text-xs border-[#E07A3F] text-[#E07A3F] hover:bg-[#E07A3F] hover:text-white h-7 px-2.5"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Novo Ponto Street View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditRoom(room)}
                              className="text-xs text-[#1F4E5F] hover:bg-[#1F4E5F]/10 h-7 px-2"
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRoom(room.id, room.name)}
                              className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Navigation Points in this Room */}
                        <div className="p-4 bg-[#FAF9F6] space-y-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-[#1C2B36]">
                            <span className="flex items-center gap-1.5">
                              <Footprints className="w-3.5 h-3.5 text-[#E07A3F]" />
                              <span>Pontos de Visão 360° no Cômodo</span>
                            </span>
                            <span className="text-[11px] text-[#5B6B76]">
                              {roomPts.length} {roomPts.length === 1 ? 'posição' : 'posições'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2.5">
                            {roomPts.map((pt, idx) => {
                              const ptThumb = pt.panorama_image
                                ? navPointsService.getFileUrl(pt, pt.panorama_image)
                                : getRoomPanoramaUrl(room.name, '', pt.name)

                              // Outgoing hotspots from this specific point
                              const pointOutgoing = roomHs.filter(
                                (h) => !h.nav_point || h.nav_point === pt.id,
                              )

                              return (
                                <div
                                  key={pt.id}
                                  className="bg-white p-3 rounded-xl border border-[#E2E6E9] shadow-xs space-y-2.5"
                                >
                                  {/* Point details row */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-10 h-8 rounded-md overflow-hidden bg-slate-100 flex-shrink-0 border border-[#E2E6E9]">
                                        <img
                                          src={ptThumb}
                                          alt={pt.name}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs font-bold text-[#1C2B36]">
                                            {pt.name}
                                          </span>
                                          {pt.is_entry && (
                                            <Badge className="bg-emerald-600 text-white text-[9px] h-4 px-1.5">
                                              Ponto Inicial
                                            </Badge>
                                          )}
                                        </div>
                                        <span className="text-[10px] text-[#5B6B76] block">
                                          Planta: X {pt.pos_x ?? 50}% • Y {pt.pos_y ?? 50}%
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                                      {connectionMode && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleOpenAddHotspot(room, pt.id)}
                                          className="h-6 text-[11px] border-[#1F4E5F] text-[#1F4E5F] hover:bg-[#1F4E5F] hover:text-white px-2"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Adicionar Seta/Saída
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleOpenEditPoint(pt, room)}
                                        className="h-6 px-1.5 text-xs text-[#1F4E5F]"
                                        title="Editar ponto"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      {roomPts.length > 1 && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeletePoint(pt.id, pt.name)}
                                          className="h-6 px-1.5 text-xs text-red-500 hover:text-red-700"
                                          title="Excluir ponto"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Outgoing hotspots from this point */}
                                  {connectionMode && (
                                    <div className="pt-2 border-t border-slate-100">
                                      {pointOutgoing.length === 0 ? (
                                        <p className="text-[10px] text-[#5B6B76] italic">
                                          Nenhuma seta saindo desta posição. Clique em "Adicionar
                                          Seta/Saída".
                                        </p>
                                      ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                          {pointOutgoing.map((hs) => {
                                            const isStep =
                                              hs.type === 'step' ||
                                              (hs.room === hs.target_room && !!hs.target_nav_point)
                                            const targetRoomObj = rooms.find(
                                              (r) => r.id === hs.target_room,
                                            )
                                            const targetPtObj = navPoints.find(
                                              (p) => p.id === hs.target_nav_point,
                                            )

                                            return (
                                              <div
                                                key={hs.id}
                                                className="flex items-center justify-between bg-[#F7F5F2] border border-[#E2E6E9] rounded-lg px-2.5 py-1.5 text-xs"
                                              >
                                                <div className="flex items-center gap-2 truncate">
                                                  <div
                                                    className={`w-5 h-5 rounded-full text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0 ${
                                                      isStep ? 'bg-[#E07A3F]' : 'bg-[#1F4E5F]'
                                                    }`}
                                                  >
                                                    {hs.direction}°
                                                  </div>
                                                  <div className="truncate">
                                                    <div className="flex items-center gap-1 font-semibold text-[#1C2B36] truncate">
                                                      <span>
                                                        {isStep
                                                          ? targetPtObj?.name || 'Próximo Ponto'
                                                          : targetRoomObj?.name || 'Outro Cômodo'}
                                                      </span>
                                                    </div>
                                                    <span className="text-[10px] text-[#5B6B76] block truncate">
                                                      {isStep
                                                        ? '🚶 Passo no mesmo cômodo'
                                                        : '🚪 Saída de ambiente'}
                                                    </span>
                                                  </div>
                                                </div>

                                                <button
                                                  onClick={() => handleDeleteHotspot(hs.id)}
                                                  className="text-slate-400 hover:text-red-500 p-1 flex-shrink-0 ml-1"
                                                  title="Remover conexão"
                                                >
                                                  <Trash2 className="w-3 h-3" />
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
                        </div>
                      </Card>
                    )
                  })}

                  <Button
                    onClick={handleOpenAddRoom}
                    className="w-full bg-[#1F4E5F] hover:bg-[#18404E] text-white font-semibold py-5 rounded-xl shadow-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Novo Ambiente
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: Floor Plan Pinning */}
            <TabsContent value="floorplan" className="space-y-4 m-0">
              <Card className="border-[#E2E6E9] shadow-sm bg-white rounded-2xl overflow-hidden p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-[#1C2B36] flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#E07A3F]" />
                      <span>Posicionamento dos Pontos de Visão na Planta</span>
                    </h3>
                    <p className="text-xs text-[#5B6B76]">
                      Arraste os marcadores numerados para posicionar cada ponto 360° exatamente
                      onde a foto foi tirada na planta.
                    </p>
                  </div>
                </div>

                {/* Interactive Floor Plan Board */}
                <div
                  ref={floorPlanRef}
                  onPointerMove={handleFloorPlanPointerMove}
                  onPointerUp={handleFloorPlanPointerUp}
                  className="relative w-full h-[450px] bg-[#FAF9F6] border-2 border-dashed border-[#1F4E5F]/30 rounded-2xl overflow-hidden select-none touch-none"
                >
                  {property.floor_plan_image ? (
                    <img
                      src={propertiesService.getFileUrl(property, property.floor_plan_image)}
                      alt="Planta do Imóvel"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  ) : (
                    <div
                      className="w-full h-full pointer-events-none"
                      dangerouslySetInnerHTML={{
                        __html: generateDemoFloorPlan(
                          property.title,
                          rooms.map((r) => ({ id: r.id, name: r.name })),
                        ),
                      }}
                    />
                  )}

                  {/* Render Draggable Nav Points */}
                  {navPoints.map((pt) => {
                    const roomObj = rooms.find((r) => r.id === pt.room)
                    const isDragging = draggingPointId === pt.id
                    const posX = pt.pos_x ?? 50
                    const posY = pt.pos_y ?? 50

                    return (
                      <div
                        key={pt.id}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          setDraggingPointId(pt.id)
                          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group z-20 flex flex-col items-center transition-transform ${
                          isDragging ? 'scale-125 z-30' : 'hover:scale-110'
                        }`}
                        style={{ left: `${posX}%`, top: `${posY}%` }}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg border-2 border-white ${
                            pt.is_entry ? 'bg-[#E07A3F]' : 'bg-[#1F4E5F]'
                          }`}
                        >
                          <Footprints className="w-4 h-4" />
                        </div>
                        <div className="mt-1 whitespace-nowrap bg-black/80 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow pointer-events-none">
                          {roomObj?.name ? `${roomObj.name}: ` : ''}
                          {pt.name}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center gap-4 text-xs text-[#5B6B76] pt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#E07A3F]" />
                    <span>Ponto inicial do cômodo</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#1F4E5F]" />
                    <span>Pontos adicionais (Street View)</span>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ================= MODAL: ADICIONAR / EDITAR AMBIENTE ================= */}
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
                Foto Panorâmica Principal 360° (Equiretangular JPG/PNG)
              </Label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#E2E6E9] hover:border-[#1F4E5F] rounded-xl p-4 cursor-pointer bg-slate-50 transition-colors">
                <UploadCloud className="w-5 h-5 text-[#1F4E5F] mb-1" />
                <span className="text-xs text-[#1C2B36] font-medium text-center">
                  {roomPanoramaFile ? roomPanoramaFile.name : 'Clique para selecionar foto 360°'}
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
                      setRoomPanoramaFile(e.target.files[0])
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

      {/* ================= MODAL: ADICIONAR / EDITAR PONTO STREET VIEW ================= */}
      <Dialog open={pointModalOpen} onOpenChange={setPointModalOpen}>
        <DialogContent className="sm:max-w-md bg-white text-[#1C2B36] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingPoint ? 'Editar Ponto de Visão' : 'Novo Ponto de Visão Street View'}
            </DialogTitle>
            <p className="text-xs text-[#5B6B76]">
              Ambiente: <strong>{targetRoomForPoint?.name}</strong>
            </p>
          </DialogHeader>

          <form onSubmit={handleSavePoint} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="pname" className="text-xs font-semibold">
                Nome da Posição *
              </Label>
              <Input
                id="pname"
                value={pointName}
                onChange={(e) => setPointName(e.target.value)}
                placeholder="Ex: Mesa de Jantar, Sofá / TV, Lado da Janela..."
                className="text-sm rounded-xl border-[#E2E6E9]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Foto Panorâmica Deste Ponto 360° (Opcional)
              </Label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#E2E6E9] hover:border-[#1F4E5F] rounded-xl p-4 cursor-pointer bg-slate-50 transition-colors">
                <UploadCloud className="w-5 h-5 text-[#1F4E5F] mb-1" />
                <span className="text-xs text-[#1C2B36] font-medium text-center">
                  {pointPanoramaFile ? pointPanoramaFile.name : 'Selecionar panorama desta posição'}
                </span>
                <span className="text-[10px] text-[#5B6B76] mt-0.5">
                  (Se omitido, herda a foto do cômodo ou demo representativo)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setPointPanoramaFile(e.target.files[0])
                    }
                  }}
                />
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#F7F5F2] rounded-xl border border-[#E2E6E9]">
              <div>
                <span className="text-xs font-semibold text-[#1C2B36] block">
                  Ponto de Entrada Inicial
                </span>
                <span className="text-[10px] text-[#5B6B76]">
                  Abrir este panorama ao entrar no cômodo
                </span>
              </div>
              <Switch checked={pointIsEntry} onCheckedChange={setPointIsEntry} />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPointModalOpen(false)}
                disabled={isSavingPoint}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingPoint} className="bg-[#1F4E5F] text-white">
                {isSavingPoint ? 'Salvando...' : 'Salvar Ponto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: ADICIONAR HOTSPOT / SETA DE DESLOCAMENTO ================= */}
      <Dialog open={hotspotModalOpen} onOpenChange={setHotspotModalOpen}>
        <DialogContent className="sm:max-w-md bg-white text-[#1C2B36] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Nova Conexão / Seta de Deslocamento
            </DialogTitle>
            <p className="text-xs text-[#5B6B76]">
              Origem: <strong>{selectedSourceRoom?.name}</strong> •{' '}
              <em>{navPoints.find((p) => p.id === selectedSourcePointId)?.name || 'Ponto'}</em>
            </p>
          </DialogHeader>

          <form onSubmit={handleSaveHotspot} className="space-y-4 pt-2">
            {/* Connection Type selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo de Deslocamento</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHotspotType('step')
                    setTargetRoomId(selectedSourceRoom?.id || '')
                    const roomPts = navPoints.filter(
                      (p) => p.room === selectedSourceRoom?.id && p.id !== selectedSourcePointId,
                    )
                    setTargetPointId(roomPts[0]?.id || '')
                    setHotspotLabel(roomPts[0]?.name ? `Ir para ${roomPts[0].name}` : '')
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors flex items-center gap-2 ${
                    hotspotType === 'step'
                      ? 'border-[#E07A3F] bg-[#E07A3F]/10 text-[#1C2B36] font-bold'
                      : 'border-[#E2E6E9] text-[#5B6B76] hover:bg-slate-50'
                  }`}
                >
                  <Footprints className="w-4 h-4 text-[#E07A3F]" />
                  <div className="text-xs">
                    <div>Passo Street View</div>
                    <div className="text-[10px] font-normal text-[#5B6B76]">Mesmo ambiente</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setHotspotType('door')
                    const otherRooms = rooms.filter((r) => r.id !== selectedSourceRoom?.id)
                    const firstOther = otherRooms[0]
                    setTargetRoomId(firstOther?.id || '')
                    const targetPts = navPoints.filter((p) => p.room === firstOther?.id)
                    setTargetPointId(targetPts[0]?.id || '')
                    setHotspotLabel(firstOther?.name ? `Ir para ${firstOther.name}` : '')
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors flex items-center gap-2 ${
                    hotspotType === 'door'
                      ? 'border-[#1F4E5F] bg-[#1F4E5F]/10 text-[#1C2B36] font-bold'
                      : 'border-[#E2E6E9] text-[#5B6B76] hover:bg-slate-50'
                  }`}
                >
                  <MoveRight className="w-4 h-4 text-[#1F4E5F]" />
                  <div className="text-xs">
                    <div>Porta / Saída</div>
                    <div className="text-[10px] font-normal text-[#5B6B76]">Mudar de cômodo</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Target Room selector (if door) */}
            {hotspotType === 'door' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Cômodo de Destino</Label>
                <Select
                  value={targetRoomId}
                  onValueChange={(val) => {
                    setTargetRoomId(val)
                    const targetPts = navPoints.filter((p) => p.room === val)
                    setTargetPointId(targetPts[0]?.id || '')
                    const r = rooms.find((rm) => rm.id === val)
                    setHotspotLabel(r ? `Ir para ${r.name}` : '')
                  }}
                >
                  <SelectTrigger className="rounded-xl border-[#E2E6E9]">
                    <SelectValue placeholder="Selecione o cômodo" />
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
            )}

            {/* Target Point Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {hotspotType === 'step'
                  ? 'Ponto de Destino no Mesmo Cômodo'
                  : 'Ponto de Chegada no Destino (Opcional)'}
              </Label>
              <Select
                value={targetPointId}
                onValueChange={(val) => {
                  setTargetPointId(val)
                  const pt = navPoints.find((p) => p.id === val)
                  if (pt && hotspotType === 'step') {
                    setHotspotLabel(`Ir para ${pt.name}`)
                  }
                }}
              >
                <SelectTrigger className="rounded-xl border-[#E2E6E9]">
                  <SelectValue placeholder="Selecione o ponto de visão" />
                </SelectTrigger>
                <SelectContent>
                  {navPoints
                    .filter(
                      (p) =>
                        p.room === targetRoomId &&
                        (hotspotType === 'door' || p.id !== selectedSourcePointId),
                    )
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Label / Tooltip text */}
            <div className="space-y-1.5">
              <Label htmlFor="hslabel" className="text-xs font-semibold">
                Rótulo da Seta (Texto exibido ao passar o mouse)
              </Label>
              <Input
                id="hslabel"
                value={hotspotLabel}
                onChange={(e) => setHotspotLabel(e.target.value)}
                placeholder="Ex: Ir para Mesa de Jantar / Caminhar até a Varanda..."
                className="text-sm rounded-xl border-[#E2E6E9]"
              />
            </div>

            {/* Circular Compass Visual Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Direção da Seta no Panorama 360°: {hotspotDirection}°
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

              <div className="flex items-center justify-center py-3 bg-[#F7F5F2] rounded-2xl border border-[#E2E6E9]">
                <div
                  className="relative w-32 h-32 rounded-full border-2 border-[#1F4E5F] flex items-center justify-center cursor-pointer select-none bg-white shadow-inner"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const cx = rect.left + rect.width / 2
                    const cy = rect.top + rect.height / 2
                    const dx = e.clientX - cx
                    const dy = e.clientY - cy
                    let deg = Math.round(Math.atan2(dx, -dy) * (180 / Math.PI))
                    if (deg < 0) deg += 360
                    setHotspotDirection(deg)
                  }}
                >
                  <span className="absolute top-1 text-[9px] font-bold text-[#1F4E5F]">0° N</span>
                  <span className="absolute right-1 text-[9px] font-bold text-[#1F4E5F]">
                    90° L
                  </span>
                  <span className="absolute bottom-1 text-[9px] font-bold text-[#1F4E5F]">
                    180° S
                  </span>
                  <span className="absolute left-1 text-[9px] font-bold text-[#1F4E5F]">
                    270° O
                  </span>

                  <div
                    className="absolute w-1 h-12 bg-gradient-to-t from-transparent to-[#E07A3F] origin-bottom rounded transition-transform duration-100"
                    style={{
                      bottom: '50%',
                      transform: `rotate(${hotspotDirection}deg)`,
                    }}
                  >
                    <div className="w-2.5 h-2.5 -top-1 -left-[3px] bg-[#E07A3F] rounded-full absolute shadow-sm" />
                  </div>
                  <div className="w-2.5 h-2.5 bg-[#1F4E5F] rounded-full z-10" />
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
