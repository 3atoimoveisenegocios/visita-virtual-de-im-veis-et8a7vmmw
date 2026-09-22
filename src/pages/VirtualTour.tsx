import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { propertiesService } from '@/services/properties'
import { roomsService } from '@/services/rooms'
import { hotspotsService } from '@/services/hotspots'
import { navPointsService } from '@/services/navPoints'
import { interactionsService } from '@/services/interactions'
import type { Property, Room, Hotspot, NavPoint } from '@/types'
import { PanoramaViewer } from '@/components/tour/PanoramaViewer'
import { getRoomPanoramaUrl, generateDemoFloorPlan } from '@/lib/panorama-assets'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Compass,
  ArrowLeft,
  ChevronDown,
  Map,
  Info,
  MessageCircle,
  X,
  Maximize2,
  Share2,
  Footprints,
  ChevronRight,
  Navigation,
} from 'lucide-react'
import { toast } from 'sonner'

export default function VirtualTour() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [property, setProperty] = useState<Property | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [allNavPoints, setAllNavPoints] = useState<NavPoint[]>([])
  const [currentPoint, setCurrentPoint] = useState<NavPoint | null>(null)
  const [roomPoints, setRoomPoints] = useState<NavPoint[]>([])
  const [currentHotspots, setCurrentHotspots] = useState<Hotspot[]>([])

  // Panels state
  const [floorPlanOpen, setFloorPlanOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  // Transition state: fade-to-black 300ms
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionMsg, setTransitionMsg] = useState('Navegando...')
  const [loading, setLoading] = useState(true)

  // Initial load
  useEffect(() => {
    async function initTour() {
      if (!id) return
      try {
        setLoading(true)
        const prop = await propertiesService.getPropertyById(id)
        setProperty(prop)

        // Record tour entry
        interactionsService.recordInteraction(id, 'tour_started')

        const rms = await roomsService.getRoomsByProperty(id)
        setRooms(rms)

        if (rms.length > 0) {
          // Fetch all nav points for all rooms
          const roomIds = rms.map((r) => r.id)
          const points = await navPointsService.getNavPointsByRooms(roomIds)
          setAllNavPoints(points)

          // Check query param ?ambiente= & ?ponto=
          const requestedRoomId = searchParams.get('ambiente')
          const requestedPointId = searchParams.get('ponto')

          const initialRoom = rms.find((r) => r.id === requestedRoomId) || rms[0]
          setCurrentRoom(initialRoom)

          // Room points
          const currentRoomPoints = points.filter((p) => p.room === initialRoom.id)
          setRoomPoints(currentRoomPoints)

          // Find current point: requested or entry point or first point
          const initialPoint =
            currentRoomPoints.find((p) => p.id === requestedPointId) ||
            currentRoomPoints.find((p) => p.is_entry) ||
            currentRoomPoints[0] ||
            null
          setCurrentPoint(initialPoint)

          // Record room visited
          interactionsService.recordInteraction(id, 'room_visited', initialRoom.id)

          // Fetch hotspots
          const hs = await hotspotsService.getHotspotsByRoom(initialRoom.id)
          // Filter hotspots for current point if point exists
          if (initialPoint) {
            const pointHs = hs.filter((h) => !h.nav_point || h.nav_point === initialPoint.id)
            setCurrentHotspots(pointHs)
          } else {
            setCurrentHotspots(hs)
          }
        }
      } catch (err) {
        console.error('Erro ao iniciar tour virtual:', err)
      } finally {
        setLoading(false)
      }
    }
    initTour()
  }, [id])

  // Move directly to a specific nav point (Street View step)
  const navigateToPoint = useCallback(
    async (targetPoint: NavPoint, targetRoom: Room) => {
      setIsTransitioning(true)
      const isSameRoom = currentRoom?.id === targetRoom.id
      setTransitionMsg(
        isSameRoom ? `Caminhando para ${targetPoint.name}...` : `Indo para ${targetRoom.name}...`,
      )

      setTimeout(async () => {
        setCurrentRoom(targetRoom)
        setCurrentPoint(targetPoint)
        setSearchParams({ ambiente: targetRoom.id, ponto: targetPoint.id })

        // Update room points if room changed
        if (!isSameRoom) {
          interactionsService.recordInteraction(property!.id, 'room_visited', targetRoom.id)
          const newRoomPoints = allNavPoints.filter((p) => p.room === targetRoom.id)
          setRoomPoints(newRoomPoints)
        }

        // Fetch hotspots for target room
        try {
          const hs = await hotspotsService.getHotspotsByRoom(targetRoom.id)
          const pointHs = hs.filter((h) => !h.nav_point || h.nav_point === targetPoint.id)
          setCurrentHotspots(pointHs)
        } catch (e) {
          console.error('Erro ao buscar hotspots:', e)
        }

        setTimeout(() => {
          setIsTransitioning(false)
        }, 150)
      }, 300)
    },
    [currentRoom, allNavPoints, property, setSearchParams],
  )

  // Handle hotspot click: either walk to next point (step) or change room (door)
  const handleHotspotClick = useCallback(
    async (hotspot: Hotspot) => {
      if (!property) return

      const isStep =
        hotspot.type === 'step' ||
        (hotspot.room === hotspot.target_room && !!hotspot.target_nav_point)

      if (isStep && hotspot.target_nav_point) {
        // Displace within same room (or connected room) point
        const targetPt =
          allNavPoints.find((p) => p.id === hotspot.target_nav_point) ||
          hotspot.expand?.target_nav_point
        const targetRm = rooms.find((r) => r.id === hotspot.target_room) || currentRoom!

        if (targetPt) {
          navigateToPoint(targetPt, targetRm)
          return
        }
      }

      // Room exit door transition
      const targetRoomId = hotspot.target_room
      if (!targetRoomId) return

      const nextRoom = rooms.find((r) => r.id === targetRoomId)
      if (!nextRoom) return

      // Find entry point for target room
      const targetRoomPoints = allNavPoints.filter((p) => p.room === nextRoom.id)
      let targetPoint = null
      if (hotspot.target_nav_point) {
        targetPoint = targetRoomPoints.find((p) => p.id === hotspot.target_nav_point) || null
      }
      if (!targetPoint) {
        targetPoint = targetRoomPoints.find((p) => p.is_entry) || targetRoomPoints[0] || null
      }

      if (targetPoint) {
        navigateToPoint(targetPoint, nextRoom)
      } else {
        // Legacy fallback
        changeRoom(nextRoom.id)
      }
    },
    [property, allNavPoints, rooms, currentRoom, navigateToPoint],
  )

  // Transition to another room with smooth 300ms fade-to-black
  const changeRoom = useCallback(
    async (targetRoomId: string) => {
      if (!property || !targetRoomId) return

      setIsTransitioning(true)
      const nextRoom = rooms.find((r) => r.id === targetRoomId)
      if (!nextRoom) return
      setTransitionMsg(`Entrando em ${nextRoom.name}...`)

      // Record room change
      interactionsService.recordInteraction(property.id, 'room_visited', targetRoomId)

      // Fade out for 300ms
      setTimeout(async () => {
        setCurrentRoom(nextRoom)

        // Find points for this room
        const pts = allNavPoints.filter((p) => p.room === nextRoom.id)
        setRoomPoints(pts)
        const entryPoint = pts.find((p) => p.is_entry) || pts[0] || null
        setCurrentPoint(entryPoint)

        if (entryPoint) {
          setSearchParams({ ambiente: nextRoom.id, ponto: entryPoint.id })
        } else {
          setSearchParams({ ambiente: nextRoom.id })
        }

        // Load hotspots for the next room
        try {
          const hs = await hotspotsService.getHotspotsByRoom(nextRoom.id)
          if (entryPoint) {
            const pointHs = hs.filter((h) => !h.nav_point || h.nav_point === entryPoint.id)
            setCurrentHotspots(pointHs)
          } else {
            setCurrentHotspots(hs)
          }
        } catch (e) {
          console.error('Erro ao buscar hotspots:', e)
        }

        // Fade back in
        setTimeout(() => {
          setIsTransitioning(false)
        }, 150)
      }, 300)
    },
    [property, rooms, allNavPoints, setSearchParams],
  )

  const handleOpenFloorPlan = () => {
    if (property) {
      interactionsService.recordInteraction(property.id, 'floor_plan_opened', currentRoom?.id)
    }
    setFloorPlanOpen(true)
  }

  const handleOpenInfo = () => {
    if (property) {
      interactionsService.recordInteraction(property.id, 'info_opened', currentRoom?.id)
    }
    setInfoOpen(true)
  }

  const handleWhatsAppClick = () => {
    if (!property) return
    interactionsService.recordInteraction(property.id, 'whatsapp_clicked', currentRoom?.id)
    const phone = (property.whatsapp_number || '5511999998888').replace(/\D/g, '')
    const currentName = currentRoom?.name || 'Visita 360°'
    const message = encodeURIComponent(
      `Olá! Estou fazendo a Visita Virtual 360° no imóvel "${property.title}" (${property.neighborhood}), exatamente no ambiente "${currentName}". Gostaria de tirar algumas dúvidas!`,
    )
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
  }

  const formatPrice = (val?: number) => {
    if (!val) return ''
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const handleShareTour = () => {
    if (navigator.share) {
      navigator.share({
        title: `${property?.title || 'Imóvel'} - Tour 360°`,
        text: `Visite o ambiente ${currentRoom?.name || ''} em 360°!`,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link do ambiente copiado para a área de transferência!')
    }
  }

  if (loading || !property || !currentRoom) {
    return (
      <div className="w-screen h-screen bg-[#1C2B36] flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-4 border-white/20 border-t-[#E07A3F] rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tight">Preparando Visita Virtual 360°</h2>
        <p className="text-sm text-white/60 mt-1">Carregando mapa esférico e ambientes...</p>
      </div>
    )
  }

  // Get active panorama URL (priority: point panorama -> room panorama -> demo)
  const pointPanoramaUrl = currentPoint?.panorama_image
    ? navPointsService.getFileUrl(currentPoint, currentPoint.panorama_image)
    : ''
  const roomPanoramaUrl = currentRoom.panorama_image
    ? roomsService.getFileUrl(currentRoom, currentRoom.panorama_image)
    : ''
  const activeUploadedUrl = pointPanoramaUrl || roomPanoramaUrl
  const panoramaUrl = getRoomPanoramaUrl(currentRoom.name, activeUploadedUrl, currentPoint?.name)

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-['Inter']">
      {/* 360° Panorama Viewer */}
      <PanoramaViewer
        imageUrl={panoramaUrl}
        roomName={currentRoom.name}
        pointName={currentPoint?.name}
        hotspots={currentHotspots}
        onHotspotClick={handleHotspotClick}
        isLoading={isTransitioning}
      />

      {/* Fade-to-black Transition Overlay (300ms) */}
      <div
        className={`absolute inset-0 bg-black pointer-events-none transition-opacity duration-300 z-30 flex flex-col items-center justify-center ${
          isTransitioning ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="w-12 h-12 border-4 border-white/20 border-t-[#E07A3F] rounded-full animate-spin mb-3" />
        <span className="text-white text-xs font-semibold tracking-wide">{transitionMsg}</span>
      </div>

      {/* ===================== HUD OVERLAY ===================== */}

      {/* Top Left: Back button + Property title */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <Button
          asChild
          size="sm"
          className="bg-[rgba(15,23,32,0.72)] hover:bg-[rgba(15,23,32,0.9)] backdrop-blur-md text-white border border-white/10 rounded-full px-3.5 py-2 shadow-lg h-auto"
        >
          <Link to={`/imovel/${property.id}`} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-[#E07A3F]" />
            <span className="text-xs font-semibold hidden sm:inline">Voltar aos imóveis</span>
          </Link>
        </Button>

        <div className="bg-[rgba(15,23,32,0.72)] backdrop-blur-md text-white border border-white/10 rounded-full px-4 py-2 shadow-lg hidden md:flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-[#E07A3F]" />
          <span className="text-xs font-semibold truncate max-w-[280px]">{property.title}</span>
          <span className="text-[11px] text-white/60">• {property.neighborhood}</span>
        </div>
      </div>

      {/* Top Right: Room Selector Dropdown + Share button */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <Button
          onClick={handleShareTour}
          size="icon"
          className="bg-[rgba(15,23,32,0.72)] hover:bg-[rgba(15,23,32,0.9)] backdrop-blur-md text-white border border-white/10 rounded-full w-9 h-9 shadow-lg"
          title="Compartilhar este ambiente"
        >
          <Share2 className="w-4 h-4 text-[#E07A3F]" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="bg-[rgba(15,23,32,0.72)] hover:bg-[rgba(15,23,32,0.9)] backdrop-blur-md text-white border border-white/10 rounded-full px-4 py-2 shadow-lg flex items-center gap-2 h-auto"
            >
              <div className="w-2 h-2 rounded-full bg-[#E07A3F] animate-ping" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold truncate max-w-[140px] sm:max-w-[180px]">
                  {currentRoom.name}
                </span>
                {currentPoint && roomPoints.length > 1 && (
                  <span className="text-[10px] text-white/60 truncate max-w-[140px] sm:max-w-[180px]">
                    {currentPoint.name}
                  </span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-white/60 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 bg-[#1C2B36]/95 backdrop-blur-md text-white border-white/10 p-1.5 rounded-xl shadow-2xl max-h-96 overflow-y-auto"
          >
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-white/50 font-bold">
              Ambientes do imóvel
            </div>
            {rooms.map((r) => {
              const rPoints = allNavPoints.filter((p) => p.room === r.id)
              const isRoomActive = r.id === currentRoom.id

              return (
                <div key={r.id} className="mb-1">
                  <DropdownMenuItem
                    onClick={() => changeRoom(r.id)}
                    className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                      isRoomActive
                        ? 'bg-[#E07A3F] text-white font-bold'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{r.name}</span>
                    {rPoints.length > 1 && (
                      <Badge
                        variant="outline"
                        className="text-[9px] border-white/20 text-white/80 h-4 px-1.5"
                      >
                        {rPoints.length} pontos
                      </Badge>
                    )}
                  </DropdownMenuItem>

                  {/* Sub-items for multiple points in the room */}
                  {isRoomActive && rPoints.length > 1 && (
                    <div className="pl-3 py-1 space-y-0.5 border-l-2 border-[#E07A3F]/50 ml-2 mt-1">
                      {rPoints.map((pt) => {
                        const isPtActive = pt.id === currentPoint?.id
                        return (
                          <button
                            key={pt.id}
                            onClick={() => navigateToPoint(pt, r)}
                            className={`w-full text-left px-2 py-1 rounded text-[11px] flex items-center gap-1.5 transition-colors ${
                              isPtActive
                                ? 'text-[#E07A3F] font-bold bg-white/10'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <Footprints className="w-3 h-3 text-[#E07A3F]" />
                            <span className="truncate">{pt.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Point Navigator HUD (Street View Points pill) when room has multiple points */}
      {roomPoints.length > 1 && currentPoint && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[rgba(15,23,32,0.75)] backdrop-blur-md border border-white/15 rounded-full px-3 py-1.5 shadow-xl max-w-[90vw] overflow-x-auto no-scrollbar">
          <Footprints className="w-3.5 h-3.5 text-[#E07A3F] flex-shrink-0" />
          <span className="text-[11px] font-bold text-white/80 flex-shrink-0 mr-1 hidden sm:inline">
            Pontos de visão:
          </span>
          <div className="flex items-center gap-1">
            {roomPoints.map((pt, idx) => {
              const isActive = pt.id === currentPoint.id
              return (
                <button
                  key={pt.id}
                  onClick={() => navigateToPoint(pt, currentRoom)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#E07A3F] text-white shadow-md scale-105'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
                  title={pt.name}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                  <span>{pt.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom Center: Horizontal Room Thumbnail Strip */}
      <div className="absolute bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 max-w-[90vw] sm:max-w-2xl">
        <div className="bg-[rgba(15,23,32,0.72)] backdrop-blur-md border border-white/10 rounded-2xl p-2 shadow-2xl flex items-center gap-2 overflow-x-auto no-scrollbar">
          {rooms.map((r) => {
            const isSelected = r.id === currentRoom.id
            const rPoints = allNavPoints.filter((p) => p.room === r.id)
            const thumbUrl = r.panorama_image
              ? roomsService.getFileUrl(r, r.panorama_image)
              : getRoomPanoramaUrl(r.name)

            return (
              <button
                key={r.id}
                onClick={() => changeRoom(r.id)}
                className={`group relative flex-shrink-0 rounded-xl overflow-hidden transition-all duration-200 text-left ${
                  isSelected
                    ? 'ring-2 ring-[#E07A3F] scale-105 shadow-md'
                    : 'opacity-70 hover:opacity-100 hover:scale-100'
                }`}
                style={{ width: '90px', height: '56px' }}
              >
                <img src={thumbUrl} alt={r.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute bottom-1 left-1.5 right-1.5 text-[10px] font-semibold text-white leading-tight truncate block">
                  {r.name}
                </span>
                {rPoints.length > 1 && (
                  <span className="absolute top-1 right-1 bg-black/60 backdrop-blur-xs text-[8px] font-bold text-white px-1 rounded-sm border border-white/20">
                    {rPoints.length}pts
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bottom Right: Floor Plan & Room Info Toggle Buttons */}
      <div className="absolute bottom-4 sm:bottom-6 right-4 z-20 flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleOpenFloorPlan}
          className="bg-[rgba(15,23,32,0.72)] hover:bg-[rgba(15,23,32,0.9)] backdrop-blur-md text-white border border-white/10 rounded-full px-3.5 py-2 shadow-lg h-auto flex items-center gap-1.5"
        >
          <Map className="w-4 h-4 text-[#E07A3F]" />
          <span className="text-xs font-semibold">Planta</span>
        </Button>

        <Button
          size="sm"
          onClick={handleOpenInfo}
          className="bg-[rgba(15,23,32,0.72)] hover:bg-[rgba(15,23,32,0.9)] backdrop-blur-md text-white border border-white/10 rounded-full px-3.5 py-2 shadow-lg h-auto flex items-center gap-1.5"
        >
          <Info className="w-4 h-4 text-[#E07A3F]" />
          <span className="text-xs font-semibold">Info</span>
        </Button>
      </div>

      {/* Bottom Left Floating Card: Price & WhatsApp CTA */}
      <div className="absolute bottom-4 sm:bottom-6 left-4 z-20 hidden sm:flex items-center gap-3 bg-[rgba(15,23,32,0.72)] backdrop-blur-md border border-white/10 rounded-2xl p-2.5 shadow-2xl">
        <div className="px-2">
          <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
            Valor
          </div>
          <div className="text-sm font-bold text-white">{formatPrice(property.price)}</div>
        </div>
        <Button
          size="sm"
          onClick={handleWhatsAppClick}
          className="bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold rounded-xl px-3 py-2 text-xs shadow-md"
        >
          <MessageCircle className="w-4 h-4 mr-1.5" />
          Falar com corretor
        </Button>
      </div>

      {/* ===================== INTERACTIVE FLOOR PLAN PANEL ===================== */}
      <Sheet open={floorPlanOpen} onOpenChange={setFloorPlanOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-[#1C2B36] text-white border-l border-white/10 p-6 flex flex-col justify-between"
        >
          <div>
            <SheetHeader className="mb-6 text-left">
              <SheetTitle className="text-white flex items-center gap-2 text-xl font-bold">
                <Map className="w-5 h-5 text-[#E07A3F]" />
                <span>Planta Interativa</span>
              </SheetTitle>
              <p className="text-xs text-white/60">
                Clique nos ambientes na planta para navegar instantaneamente
              </p>
            </SheetHeader>

            {/* Floor Plan Display with Interactive Point Markers */}
            <div className="bg-[#FAF9F6] rounded-2xl p-3 border border-white/10 shadow-inner overflow-hidden mb-4 relative">
              {property.floor_plan_image ? (
                <div className="relative">
                  <img
                    src={propertiesService.getFileUrl(property, property.floor_plan_image)}
                    alt="Planta do Imóvel"
                    className="w-full h-auto rounded-lg object-contain"
                  />
                </div>
              ) : (
                <div className="relative w-full h-64 rounded-lg overflow-hidden flex items-center justify-center">
                  <div
                    className="w-full h-full"
                    dangerouslySetInnerHTML={{
                      __html: generateDemoFloorPlan(
                        property.title,
                        rooms.map((r) => ({ id: r.id, name: r.name })),
                      ),
                    }}
                  />
                  {/* Position markers on the floor plan for current room's points */}
                  <div className="absolute inset-0 pointer-events-auto">
                    {roomPoints.map((pt) => {
                      const isCurrent = pt.id === currentPoint?.id
                      const posX = pt.pos_x ?? 50
                      const posY = pt.pos_y ?? 50

                      return (
                        <button
                          key={pt.id}
                          onClick={() => {
                            navigateToPoint(pt, currentRoom)
                            setFloorPlanOpen(false)
                          }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5 transition-all shadow-lg flex items-center justify-center ${
                            isCurrent
                              ? 'bg-[#E07A3F] text-white ring-4 ring-[#E07A3F]/30 scale-125 z-10'
                              : 'bg-[#1F4E5F] text-white hover:bg-[#E07A3F] hover:scale-110'
                          }`}
                          style={{ left: `${posX}%`, top: `${posY}%` }}
                          title={pt.name}
                        >
                          <Footprints className="w-3 h-3" />
                          <span className="sr-only">{pt.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Room Jump List from Floor Plan */}
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-wider text-white/50 font-bold mb-1">
                Selecione o cômodo e o ponto
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                {rooms.map((r) => {
                  const isActive = r.id === currentRoom.id
                  const rPoints = allNavPoints.filter((p) => p.room === r.id)

                  return (
                    <div key={r.id} className="space-y-1">
                      <button
                        onClick={() => {
                          changeRoom(r.id)
                          setFloorPlanOpen(false)
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs transition-colors border ${
                          isActive
                            ? 'bg-[#E07A3F] border-[#E07A3F] text-white font-bold'
                            : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              isActive ? 'bg-white' : 'bg-[#E07A3F]'
                            }`}
                          />
                          <span>{r.name}</span>
                        </div>
                        {r.dimensions && (
                          <span className="text-[10px] opacity-75">{r.dimensions}</span>
                        )}
                      </button>

                      {/* Expanded points when room is active and has multiple points */}
                      {isActive && rPoints.length > 1 && (
                        <div className="grid grid-cols-1 gap-1 pl-4 pt-1">
                          {rPoints.map((pt) => {
                            const isPtActive = pt.id === currentPoint?.id
                            return (
                              <button
                                key={pt.id}
                                onClick={() => {
                                  navigateToPoint(pt, r)
                                  setFloorPlanOpen(false)
                                }}
                                className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-[11px] transition-colors border ${
                                  isPtActive
                                    ? 'bg-white/20 border-white/30 text-white font-bold'
                                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <Footprints className="w-3 h-3 text-[#E07A3F]" />
                                  <span>{pt.name}</span>
                                </div>
                                {isPtActive && (
                                  <Badge className="bg-[#E07A3F] text-[9px] h-4 px-1.5">
                                    Atual
                                  </Badge>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10">
            <Button
              onClick={handleWhatsAppClick}
              className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-5 rounded-xl shadow-md text-xs"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Tirar dúvidas sobre a planta no WhatsApp
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ===================== ROOM INFO PANEL ===================== */}
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent
          side="left"
          className="w-full sm:max-w-md bg-[#1C2B36] text-white border-r border-white/10 p-6 flex flex-col justify-between"
        >
          <div>
            <SheetHeader className="mb-6 text-left">
              <SheetTitle className="text-white flex items-center gap-2 text-xl font-bold">
                <Info className="w-5 h-5 text-[#E07A3F]" />
                <span>Detalhes do Ambiente</span>
              </SheetTitle>
              <p className="text-xs text-white/60">
                Informações técnicas e dimensões do cômodo atual
              </p>
            </SheetHeader>

            <div className="space-y-6">
              {/* Room Name & Active Point Badge */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-[#E07A3F] font-bold mb-1">
                  Ambiente Atual
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">{currentRoom.name}</h3>
                {currentPoint && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-2 font-medium">
                    <Footprints className="w-3.5 h-3.5" />
                    <span>Ponto de observação: {currentPoint.name}</span>
                  </div>
                )}
                {currentRoom.dimensions && (
                  <div className="flex items-center gap-1.5 text-xs text-white/70">
                    <Maximize2 className="w-3.5 h-3.5 text-[#E07A3F]" />
                    <span>
                      Dimensões: <strong>{currentRoom.dimensions}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Room Description */}
              {currentRoom.description && (
                <div className="space-y-2">
                  <h4 className="text-xs uppercase tracking-wider text-white/50 font-bold">
                    Descrição do Espaço
                  </h4>
                  <p className="text-sm text-white/80 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/10">
                    {currentRoom.description}
                  </p>
                </div>
              )}

              {/* Property summary */}
              <div className="space-y-2">
                <h4 className="text-xs uppercase tracking-wider text-white/50 font-bold">
                  Sobre o Imóvel
                </h4>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 space-y-1.5">
                  <div className="text-white font-semibold">{property.title}</div>
                  <div>
                    Localização: {property.neighborhood}, {property.city}
                  </div>
                  <div className="text-[#E07A3F] font-bold text-sm pt-1">
                    {formatPrice(property.price)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 space-y-3">
            <Button
              onClick={handleWhatsAppClick}
              className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-5 rounded-xl shadow-md text-xs"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Falar com o corretor sobre este ambiente
            </Button>
            <Button
              variant="outline"
              onClick={() => setInfoOpen(false)}
              className="w-full border-white/20 text-white hover:bg-white/10 py-5 rounded-xl text-xs"
            >
              Continuar navegando em 360°
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
