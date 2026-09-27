import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
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
  Maximize2,
  Minimize2,
  Share2,
  Footprints,
  Eye,
  Building2,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function VirtualTour() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const [property, setProperty] = useState<Property | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [allNavPoints, setAllNavPoints] = useState<NavPoint[]>([])
  const [currentPoint, setCurrentPoint] = useState<NavPoint | null>(null)
  const [roomPoints, setRoomPoints] = useState<NavPoint[]>([])
  const [currentHotspots, setCurrentHotspots] = useState<Hotspot[]>([])

  // Panels & Fullscreen state
  const [floorPlanOpen, setFloorPlanOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const frameContainerRef = useRef<HTMLDivElement>(null)

  // Transition state: fade-to-black 300ms
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionMsg, setTransitionMsg] = useState('Navegando...')
  const [loading, setLoading] = useState(true)

  // Synchronize fullscreen change events (browser ESC or Fullscreen API)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const activeEl = document.fullscreenElement
      setIsFullscreen(Boolean(activeEl && frameContainerRef.current?.contains(activeEl)))
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Toggle true DOM fullscreen on the showcase frame container
  const toggleFullscreen = useCallback(async () => {
    const elem = frameContainerRef.current
    if (!elem) return

    try {
      if (!document.fullscreenElement) {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        }
      }
    } catch (err) {
      console.warn('Erro ao alternar modo tela cheia:', err)
      // Fallback: toggle internal state
      setIsFullscreen((prev) => !prev)
    }
  }, [])

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

        if (!isSameRoom && property) {
          interactionsService.recordInteraction(property.id, 'room_visited', targetRoom.id)
          const newRoomPoints = allNavPoints.filter((p) => p.room === targetRoom.id)
          setRoomPoints(newRoomPoints)
        }

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

      interactionsService.recordInteraction(property.id, 'room_visited', targetRoomId)

      setTimeout(async () => {
        setCurrentRoom(nextRoom)

        const pts = allNavPoints.filter((p) => p.room === nextRoom.id)
        setRoomPoints(pts)
        const entryPoint = pts.find((p) => p.is_entry) || pts[0] || null
        setCurrentPoint(entryPoint)

        if (entryPoint) {
          setSearchParams({ ambiente: nextRoom.id, ponto: entryPoint.id })
        } else {
          setSearchParams({ ambiente: nextRoom.id })
        }

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
    if (property) {
      interactionsService.recordInteraction(property.id, 'whatsapp_clicked', currentRoom?.id)
    }
    window.open('https://wa.me/551144227729', '_blank', 'noopener,noreferrer')
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
      <div className="flex-1 w-full flex flex-col items-center justify-center text-white py-24 px-4">
        <div className="w-14 h-14 border-4 border-white/20 border-t-[#E07A3F] rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tight">Preparando Visita Virtual 360°</h2>
        <p className="text-sm text-white/60 mt-1">Carregando mapa esférico e ambientes...</p>
      </div>
    )
  }

  // Active panorama URL (priority: point panorama -> room panorama -> demo)
  const pointPanoramaUrl = currentPoint?.panorama_image
    ? navPointsService.getFileUrl(currentPoint, currentPoint.panorama_image)
    : ''
  const roomPanoramaUrl = currentRoom.panorama_image
    ? roomsService.getFileUrl(currentRoom, currentRoom.panorama_image)
    : ''
  const activeUploadedUrl = pointPanoramaUrl || roomPanoramaUrl
  const panoramaUrl = getRoomPanoramaUrl(currentRoom.name, activeUploadedUrl, currentPoint?.name)

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-4 font-['Inter']">
      {/* ===================== CABEÇALHO DO IMÓVEL (acima da moldura) ===================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#1C2B36]/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10 shadow-xl">
        <div className="flex items-start sm:items-center gap-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-white/15 bg-white/5 hover:bg-white/10 text-white rounded-xl h-9 px-3 shrink-0"
          >
            <Link to={`/imovel/${property.id}`} className="flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4 text-[#E07A3F]" />
              <span className="text-xs font-semibold hidden sm:inline">Voltar ao imóvel</span>
            </Link>
          </Button>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#E07A3F] bg-[#E07A3F]/15 px-2 py-0.5 rounded-full border border-[#E07A3F]/30">
                <Sparkles className="w-3 h-3" />
                Tour Virtual 360°
              </span>
              <span className="text-xs text-white/50 hidden sm:inline">•</span>
              <span className="text-xs text-white/70 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#E07A3F]" />
                {property.neighborhood}
                {property.city ? `, ${property.city}` : ''}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-white tracking-tight line-clamp-1">
              {property.title}
            </h1>
          </div>
        </div>

        {/* Preço e Botão Compartilhar */}
        <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
          <div className="text-left md:text-right">
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
              Valor de venda
            </div>
            <div className="text-base sm:text-lg font-extrabold text-[#E07A3F]">
              {formatPrice(property.price) || 'Consulte'}
            </div>
          </div>

          <Button
            onClick={handleShareTour}
            variant="outline"
            size="sm"
            className="border-white/15 bg-white/5 hover:bg-white/10 text-white rounded-xl h-9 px-3 gap-1.5 text-xs"
            title="Compartilhar este tour"
          >
            <Share2 className="w-3.5 h-3.5 text-[#E07A3F]" />
            <span className="hidden sm:inline">Compartilhar</span>
          </Button>
        </div>
      </div>

      {/* ===================== COMPOSIÇÃO PRINCIPAL (Moldura do Tour + Painel Lateral) ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
        {/* MOLDURA VITRINE DO TOUR VIRTUAL (8 ou 9 colunas no desktop, altura controlada) */}
        <div
          ref={frameContainerRef}
          className={cn(
            'relative w-full rounded-3xl overflow-hidden bg-black border-2 border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6)] group select-none transition-all duration-300',
            isFullscreen
              ? 'fixed inset-0 z-50 rounded-none border-0 h-screen w-screen'
              : 'lg:col-span-8 xl:col-span-8 aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/10] min-h-[380px] max-h-[72vh]',
          )}
        >
          {/* Visualizador 360° Three.js com Projeção Esférica */}
          <PanoramaViewer
            imageUrl={panoramaUrl}
            roomName={currentRoom.name}
            pointName={currentPoint?.name}
            hotspots={currentHotspots}
            onHotspotClick={handleHotspotClick}
            isLoading={isTransitioning}
            initialYaw={currentPoint?.initial_yaw ?? currentRoom.initial_yaw ?? 0}
            initialPitch={currentPoint?.initial_pitch ?? currentRoom.initial_pitch ?? 0}
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

          {/* ===================== CONTROLES INTERNOS DA MOLDURA ===================== */}

          {/* Top-left: Seletor de cômodos / Dropdown */}
          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-20 flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="bg-[#1C2B36]/85 hover:bg-[#1C2B36] backdrop-blur-md text-white border border-white/15 rounded-full px-3.5 py-1.5 shadow-xl flex items-center gap-2 h-auto transition-transform hover:scale-102"
                >
                  <div className="w-2 h-2 rounded-full bg-[#E07A3F] animate-ping" />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold truncate max-w-[130px] sm:max-w-[180px]">
                      {currentRoom.name}
                    </span>
                    {currentPoint && roomPoints.length > 1 && (
                      <span className="text-[10px] text-white/60 truncate max-w-[130px] sm:max-w-[180px]">
                        {currentPoint.name}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-white/60 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-64 bg-[#1C2B36]/95 backdrop-blur-md text-white border-white/15 p-1.5 rounded-2xl shadow-2xl max-h-96 overflow-y-auto"
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
                        className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
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

                      {/* Sub-items for multiple points */}
                      {isRoomActive && rPoints.length > 1 && (
                        <div className="pl-3 py-1 space-y-0.5 border-l-2 border-[#E07A3F]/50 ml-2 mt-1">
                          {rPoints.map((pt) => {
                            const isPtActive = pt.id === currentPoint?.id
                            return (
                              <button
                                key={pt.id}
                                onClick={() => navigateToPoint(pt, r)}
                                className={`w-full text-left px-2 py-1 rounded-lg text-[11px] flex items-center gap-1.5 transition-colors ${
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

          {/* Top-right: Botão de TELA CHEIA (expandir/recolher moldura) */}
          <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-20 flex items-center gap-2">
            <Button
              size="sm"
              onClick={toggleFullscreen}
              className="bg-[#1C2B36]/85 hover:bg-[#1C2B36] backdrop-blur-md text-white border border-white/15 rounded-full px-3 py-1.5 shadow-xl flex items-center gap-1.5 h-auto transition-transform hover:scale-105"
              title={isFullscreen ? 'Recolher para moldura' : 'Expandir para tela cheia'}
              aria-label={isFullscreen ? 'Recolher para moldura' : 'Expandir para tela cheia'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-[#E07A3F]" />
                  <span className="text-xs font-semibold hidden sm:inline">Recolher</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-[#E07A3F]" />
                  <span className="text-xs font-semibold hidden sm:inline">Tela cheia</span>
                </>
              )}
            </Button>
          </div>

          {/* Point Navigator HUD (Street View Points pill) when room has multiple points */}
          {roomPoints.length > 1 && currentPoint && (
            <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[#1C2B36]/90 backdrop-blur-md border border-white/15 rounded-full px-3 py-1 shadow-xl max-w-[90%] overflow-x-auto no-scrollbar">
              <Footprints className="w-3 h-3 text-[#E07A3F] flex-shrink-0" />
              <span className="text-[10px] font-bold text-white/80 flex-shrink-0 mr-1 hidden sm:inline">
                Pontos de visão:
              </span>
              <div className="flex items-center gap-1">
                {roomPoints.map((pt) => {
                  const isActive = pt.id === currentPoint.id
                  return (
                    <button
                      key={pt.id}
                      onClick={() => navigateToPoint(pt, currentRoom)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                        isActive
                          ? 'bg-[#E07A3F] text-white shadow-md'
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

          {/* Bottom Center: Mini strip horizontal com miniaturas de ambientes */}
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[92%] sm:max-w-xl">
            <div className="bg-[#1C2B36]/85 backdrop-blur-md border border-white/15 rounded-2xl p-1.5 sm:p-2 shadow-2xl flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
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
                    style={{ width: '74px', height: '48px' }}
                    title={r.name}
                  >
                    <img src={thumbUrl} alt={r.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <span className="absolute bottom-1 left-1 right-1 text-[9px] font-semibold text-white leading-tight truncate block">
                      {r.name}
                    </span>
                    {rPoints.length > 1 && (
                      <span className="absolute top-1 right-1 bg-black/70 backdrop-blur-xs text-[8px] font-bold text-white px-1 rounded-sm border border-white/20">
                        {rPoints.length}p
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bottom Left: Atalho para Planta Interativa dentro da moldura */}
          <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 z-20 flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={handleOpenFloorPlan}
              className="bg-[#1C2B36]/85 hover:bg-[#1C2B36] backdrop-blur-md text-white border border-white/15 rounded-full px-3 py-1.5 shadow-xl flex items-center gap-1.5 h-auto text-xs font-semibold"
            >
              <Map className="w-3.5 h-3.5 text-[#E07A3F]" />
              <span>Planta</span>
            </Button>
          </div>
        </div>

        {/* ===================== PAINEL LATERAL (desktop) / FAIXA INFERIOR (mobile) ===================== */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-4">
          {/* Card de Informações do Ambiente Atual */}
          <div className="bg-[#1C2B36]/80 backdrop-blur-md rounded-3xl p-5 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#E07A3F] font-bold">
                  Ambiente Atual
                </span>
                <h2 className="text-xl font-extrabold text-white mt-0.5">{currentRoom.name}</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInfo}
                className="border-white/15 bg-white/5 hover:bg-white/10 text-white rounded-xl h-8 px-2.5 text-xs gap-1"
                title="Ver detalhes completos"
              >
                <Info className="w-3.5 h-3.5 text-[#E07A3F]" />
                <span>Info</span>
              </Button>
            </div>

            {/* Ponto de observação & Dimensões */}
            <div className="space-y-2">
              {currentPoint && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20 font-medium">
                  <Footprints className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="truncate">Ponto: {currentPoint.name}</span>
                </div>
              )}

              {currentRoom.dimensions && (
                <div className="flex items-center justify-between text-xs text-white/80 bg-white/5 px-3 py-2 rounded-xl border border-white/10">
                  <span className="text-white/50">Dimensões:</span>
                  <span className="font-semibold text-white">{currentRoom.dimensions}</span>
                </div>
              )}

              {currentRoom.description && (
                <p className="text-xs text-white/70 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10 line-clamp-3">
                  {currentRoom.description}
                </p>
              )}
            </div>

            {/* Mini preview da Planta Ancorada no painel lateral */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white/80 flex items-center gap-1.5">
                  <Map className="w-3.5 h-3.5 text-[#E07A3F]" />
                  Planta do Imóvel
                </span>
                <button
                  type="button"
                  onClick={handleOpenFloorPlan}
                  className="text-[11px] text-[#E07A3F] hover:underline font-semibold"
                >
                  Ampliar
                </button>
              </div>

              <div
                onClick={handleOpenFloorPlan}
                className="relative bg-[#FAF9F6] rounded-2xl overflow-hidden border border-white/10 cursor-pointer shadow-inner group/plan h-36 flex items-center justify-center p-2"
                title="Clique para abrir planta completa"
              >
                {property.floor_plan_image ? (
                  <img
                    src={propertiesService.getFileUrl(property, property.floor_plan_image)}
                    alt="Planta do Imóvel"
                    className="max-h-full max-w-full object-contain transition-transform group-hover/plan:scale-105"
                  />
                ) : (
                  <div
                    className="w-full h-full scale-90 transition-transform group-hover/plan:scale-95 pointer-events-none"
                    dangerouslySetInnerHTML={{
                      __html: generateDemoFloorPlan(
                        property.title,
                        rooms.map((r) => ({ id: r.id, name: r.name })),
                      ),
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-[#1C2B36]/20 opacity-0 group-hover/plan:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="bg-[#1C2B36]/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-full border border-white/20 shadow-md">
                    Abrir Planta
                  </span>
                </div>
              </div>
            </div>

            {/* Botão de WhatsApp (verde oficial) */}
            <Button
              onClick={handleWhatsAppClick}
              className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold py-5 rounded-2xl shadow-lg transition-transform hover:scale-101 flex items-center justify-center gap-2 text-sm"
            >
              <MessageCircle className="w-5 h-5 fill-current" />
              <span>Falar com corretor no WhatsApp</span>
            </Button>
          </div>

          {/* Card Resumo do Imóvel */}
          <div className="bg-[#1C2B36]/60 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-xs text-white/70 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Building2 className="w-4 h-4 text-[#E07A3F]" />
              <span>3° ATO Imóveis e Negócios</span>
            </div>
            <p className="text-white/60 text-[11px] leading-relaxed">
              Deseja agendar uma visita presencial ou tirar dúvidas sobre as condições deste imóvel?
              Nossa equipe está pronta para atender você.
            </p>
          </div>
        </div>
      </div>

      {/* ===================== MODAL DA PLANTA INTERATIVA ===================== */}
      <Sheet open={floorPlanOpen} onOpenChange={setFloorPlanOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-[#1C2B36] text-white border-l border-white/10 p-6 flex flex-col justify-between"
        >
          <div>
            <SheetHeader className="mb-5 text-left">
              <SheetTitle className="text-white flex items-center gap-2 text-xl font-bold">
                <Map className="w-5 h-5 text-[#E07A3F]" />
                <span>Planta Interativa</span>
              </SheetTitle>
              <p className="text-xs text-white/60">
                Clique nos ambientes na planta para navegar instantaneamente
              </p>
            </SheetHeader>

            {/* Visualização da Planta */}
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
                  {/* Marcadores dos pontos do cômodo atual */}
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

            {/* Lista de Ambientes e Pontos */}
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

          <div className="pt-5 border-t border-white/10">
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

      {/* ===================== MODAL DE INFORMAÇÕES DO AMBIENTE ===================== */}
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

            <div className="space-y-5">
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

          <div className="pt-6 border-t border-white/10 space-y-2.5">
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
