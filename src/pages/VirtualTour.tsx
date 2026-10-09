import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { propertiesService } from '@/services/properties'
import { roomsService } from '@/services/rooms'
import { hotspotsService } from '@/services/hotspots'
import { navPointsService } from '@/services/navPoints'
import { interactionsService } from '@/services/interactions'
import type { Property, Room, Hotspot, NavPoint } from '@/types'
import { PanoramaViewer } from '@/components/tour/PanoramaViewer'
import { getRoomPanoramaUrl, resolveNavPointImageUrl } from '@/lib/panorama-assets'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  ArrowLeft,
  Map,
  Info,
  MessageCircle,
  Maximize2,
  Minimize2,
  Share2,
  Check,
  Footprints,
  Building2,
  MapPin,
  Sparkles,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function VirtualTour() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const isEmbed = searchParams.get('embed') === '1'

  const [property, setProperty] = useState<Property | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [allNavPoints, setAllNavPoints] = useState<NavPoint[]>([])
  const [currentPoint, setCurrentPoint] = useState<NavPoint | null>(null)
  const [roomPoints, setRoomPoints] = useState<NavPoint[]>([])
  const [currentHotspots, setCurrentHotspots] = useState<Hotspot[]>([])
  const [isDescExpanded, setIsDescExpanded] = useState(false)
  const [isDescClamped, setIsDescClamped] = useState(false)
  const descRef = useRef<HTMLParagraphElement>(null)

  // Reset description expand state whenever room changes
  useEffect(() => {
    setIsDescExpanded(false)
  }, [currentRoom?.id])

  // Check if current room description overflows its container (~4 lines)
  useEffect(() => {
    const el = descRef.current
    if (!el || !currentRoom?.description) {
      setIsDescClamped(false)
      return
    }
    const checkOverflow = () => {
      // scrollHeight > clientHeight indicates the text exceeds the clamped container
      setIsDescClamped(el.scrollHeight > el.clientHeight + 1)
    }
    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [currentRoom?.description, isDescExpanded])

  // Panels & Fullscreen state
  const [floorPlanOpen, setFloorPlanOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(true)
  const frameContainerRef = useRef<HTMLDivElement>(null)

  // Background Music state (single persistent HTMLAudioElement instance)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const audioInstanceRef = useRef<HTMLAudioElement | null>(null)

  // Transition state: fade-to-black 300ms
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionMsg, setTransitionMsg] = useState('Navegando...')
  const [loading, setLoading] = useState(true)

  // Synchronize fullscreen change events (standard, webkit, moz, ms)
  useEffect(() => {
    const getActiveFullscreenElement = (): Element | null => {
      const doc = document as unknown as {
        fullscreenElement?: Element | null
        webkitFullscreenElement?: Element | null
        mozFullScreenElement?: Element | null
        msFullscreenElement?: Element | null
      }
      return (
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement ||
        null
      )
    }

    // Check if fullscreen is supported on this browser/device
    const checkFullscreenSupport = () => {
      const doc = document as unknown as {
        fullscreenEnabled?: boolean
        webkitFullscreenEnabled?: boolean
        mozFullScreenEnabled?: boolean
        msFullscreenEnabled?: boolean
      }
      const el = frameContainerRef.current as unknown as {
        requestFullscreen?: () => Promise<void>
        webkitRequestFullscreen?: () => Promise<void>
        mozRequestFullScreen?: () => Promise<void>
        msRequestFullscreen?: () => Promise<void>
      } | null

      const docSupport =
        Boolean(doc.fullscreenEnabled) ||
        Boolean(doc.webkitFullscreenEnabled) ||
        Boolean(doc.mozFullScreenEnabled) ||
        Boolean(doc.msFullscreenEnabled)

      const elemSupport =
        Boolean(el?.requestFullscreen) ||
        Boolean(el?.webkitRequestFullscreen) ||
        Boolean(el?.mozRequestFullScreen) ||
        Boolean(el?.msRequestFullscreen)

      // Always supported either through native APIs or CSS fallback for mobile
      setIsFullscreenSupported(docSupport || elemSupport || typeof window !== 'undefined')
    }
    checkFullscreenSupport()

    const handleFullscreenChange = () => {
      const activeEl = getActiveFullscreenElement()
      if (activeEl) {
        setIsFullscreen(
          Boolean(
            frameContainerRef.current &&
            (frameContainerRef.current === activeEl ||
              frameContainerRef.current.contains(activeEl)),
          ),
        )
      } else {
        // Exited native fullscreen
        setIsFullscreen(false)
      }
    }

    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange',
    ]

    events.forEach((evt) => document.addEventListener(evt, handleFullscreenChange))
    return () => {
      events.forEach((evt) => document.removeEventListener(evt, handleFullscreenChange))
    }
  }, [])

  // Toggle DOM / vendor fullscreen on the showcase frame container with mobile fallbacks
  const toggleFullscreen = useCallback(async () => {
    const elem = frameContainerRef.current as unknown as {
      requestFullscreen?: () => Promise<void>
      webkitRequestFullscreen?: () => Promise<void>
      mozRequestFullScreen?: () => Promise<void>
      msRequestFullscreen?: () => Promise<void>
    } | null

    const doc = document as unknown as {
      fullscreenElement?: Element | null
      webkitFullscreenElement?: Element | null
      mozFullScreenElement?: Element | null
      msFullscreenElement?: Element | null
      exitFullscreen?: () => Promise<void>
      webkitExitFullscreen?: () => Promise<void>
      mozCancelFullScreen?: () => Promise<void>
      msExitFullscreen?: () => Promise<void>
      documentElement: {
        requestFullscreen?: () => Promise<void>
        webkitRequestFullscreen?: () => Promise<void>
        mozRequestFullScreen?: () => Promise<void>
        msRequestFullscreen?: () => Promise<void>
      }
    }

    const currentFs =
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement

    // Case 1: Already active -> exit fullscreen
    if (isFullscreen || currentFs) {
      try {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen()
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen()
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen()
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen()
        }
      } catch (err) {
        console.warn('Erro ao sair do fullscreen nativo:', err)
      } finally {
        setIsFullscreen(false)
      }
      return
    }

    // Case 2: Inactive -> request fullscreen with multi-step fallback
    let entered = false

    // Try container element fullscreen first
    if (elem) {
      try {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen()
          entered = true
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen()
          entered = true
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen()
          entered = true
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen()
          entered = true
        }
      } catch (err) {
        console.warn(
          'Falha no requestFullscreen do elemento, tentando fallback para documentElement:',
          err,
        )
      }
    }

    // Fallback 1: document.documentElement fullscreen (Android Chrome / tablet edge cases)
    if (!entered && doc.documentElement) {
      try {
        if (doc.documentElement.requestFullscreen) {
          await doc.documentElement.requestFullscreen()
          entered = true
        } else if (doc.documentElement.webkitRequestFullscreen) {
          await doc.documentElement.webkitRequestFullscreen()
          entered = true
        }
      } catch (err) {
        console.warn('Falha no fallback de fullscreen do documentElement:', err)
      }
    }

    // Fallback 2: CSS full viewport overlay (e.g. iOS Safari iPhone which lacks element.requestFullscreen)
    // When isFullscreen = true, the frame container applies `fixed inset-0 z-50 rounded-none border-0 h-screen w-screen`
    setIsFullscreen(true)
  }, [isFullscreen])

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

  // Manage persistent background music instance across room transitions
  useEffect(() => {
    if (!property?.background_music) {
      if (audioInstanceRef.current) {
        audioInstanceRef.current.pause()
        audioInstanceRef.current.src = ''
        audioInstanceRef.current = null
        setIsAudioPlaying(false)
      }
      return
    }

    const musicUrl = propertiesService.getFileUrl(property, property.background_music)
    if (!musicUrl) return

    if (!audioInstanceRef.current) {
      const audio = new Audio(musicUrl)
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = 0.5 // volume agradável e suave
      audio.onplay = () => setIsAudioPlaying(true)
      audio.onpause = () => setIsAudioPlaying(false)
      audio.onerror = (e) => {
        console.warn('Erro ao carregar ou reproduzir áudio de fundo:', e)
        setIsAudioPlaying(false)
      }
      audioInstanceRef.current = audio
    } else if (audioInstanceRef.current.src !== musicUrl) {
      const wasPlaying = !audioInstanceRef.current.paused
      audioInstanceRef.current.src = musicUrl
      audioInstanceRef.current.currentTime = 0
      if (wasPlaying) {
        audioInstanceRef.current.play().catch(() => setIsAudioPlaying(false))
      }
    }

    // Cleanup when unmounting the VirtualTour page entirely
    return () => {
      if (audioInstanceRef.current) {
        audioInstanceRef.current.pause()
        audioInstanceRef.current.src = ''
        audioInstanceRef.current = null
      }
    }
  }, [property?.background_music, property])

  // Toggle play/pause for background music
  const toggleBackgroundMusic = useCallback(() => {
    if (!audioInstanceRef.current) return

    if (audioInstanceRef.current.paused) {
      audioInstanceRef.current
        .play()
        .then(() => {
          setIsAudioPlaying(true)
          toast.success('Música ativada', { duration: 1500 })
        })
        .catch((err) => {
          console.error('Autoplay/play bloqueado pelo navegador:', err)
          setIsAudioPlaying(false)
          toast.error('Não foi possível iniciar o áudio.')
        })
    } else {
      audioInstanceRef.current.pause()
      setIsAudioPlaying(false)
      toast.info('Música pausada', { duration: 1500 })
    }
  }, [])

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
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.set('ambiente', targetRoom.id)
          next.set('ponto', targetPoint.id)
          return next
        })

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

        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.set('ambiente', nextRoom.id)
          if (entryPoint) {
            next.set('ponto', entryPoint.id)
          } else {
            next.delete('ponto')
          }
          return next
        })

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

  const [copiedLink, setCopiedLink] = useState(false)

  // Share current room & point with exact URL query params
  const handleShareTour = () => {
    const currentUrl = window.location.href
    const roomText = currentRoom?.name ? ` ${currentRoom.name}` : ''
    const pointText = currentPoint?.name ? ` (${currentPoint.name})` : ''

    if (navigator.share) {
      navigator
        .share({
          title: `${property?.title || 'Imóvel'} - Tour 360°`,
          text: `Visite o ambiente${roomText}${pointText} no Tour Virtual 360°!`,
          url: currentUrl,
        })
        .catch(() => {
          // If native share dialog was cancelled or failed, copy to clipboard
          navigator.clipboard.writeText(currentUrl)
          setCopiedLink(true)
          toast.success('Link deste ambiente copiado!')
          setTimeout(() => setCopiedLink(false), 2500)
        })
    } else {
      navigator.clipboard.writeText(currentUrl)
      setCopiedLink(true)
      toast.success('Link deste ambiente copiado para a área de transferência!')
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  // Open WhatsApp with predefined message pointing to current room & point
  const handleShareOnWhatsApp = () => {
    if (property) {
      interactionsService.recordInteraction(property.id, 'whatsapp_clicked', currentRoom?.id)
    }
    const currentUrl = window.location.href
    const text = encodeURIComponent(
      `Olá! Veja este tour 360° de "${property?.title}": ambiente ${currentRoom?.name || ''}${
        currentPoint ? ` (${currentPoint.name})` : ''
      }\n\n${currentUrl}`,
    )
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  if (loading || !property || !currentRoom) {
    return (
      <div
        className={cn(
          'flex-1 w-full flex flex-col items-center justify-center text-white px-4',
          isEmbed ? 'h-screen w-screen bg-black' : 'py-24',
        )}
      >
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
  const panoramaUrl = resolveNavPointImageUrl({
    pointPanoramaUrl,
    roomPanoramaUrl,
    roomName: currentRoom.name,
    pointName: currentPoint?.name,
  })

  // ================= MODO EMBED (?embed=1) =================
  // Renderiza APENAS o visor 360° em tela cheia (100vw × 100vh), sem cabeçalho,
  // sem menu, sem rodapé, sem margens ou paddings. Todos os controles internos
  // continuam presentes e funcionais: setas de deslocamento, seletor de pontos,
  // botão de planta, botão de som/música, painel de ambiente atual, botões de compartilhamento etc.
  if (isEmbed) {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-['Inter'] m-0 p-0">
        {/* Visualizador 360° Three.js ocupando 100% da viewport */}
        <PanoramaViewer
          imageUrl={panoramaUrl}
          roomId={currentRoom.id}
          roomName={currentRoom.name}
          pointId={currentPoint?.id}
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

        {/* Top-right: Botão de TELA CHEIA nativa do navegador */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
          {isFullscreenSupported && (
            <Button
              size="sm"
              onClick={toggleFullscreen}
              className="bg-black/60 hover:bg-black/85 backdrop-blur-md text-white/90 hover:text-white border border-white/10 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5 h-8 sm:h-9 transition-all text-xs"
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-[#E07A3F]" />
                  <span className="font-semibold hidden sm:inline">Recolher</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-[#E07A3F]" />
                  <span className="font-semibold hidden sm:inline">Tela cheia</span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* Top-left: Título sutil do Imóvel e Ambiente */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex items-center gap-2 max-w-[70%] sm:max-w-md pointer-events-auto">
          <div className="bg-black/65 backdrop-blur-md text-white/95 border border-white/15 rounded-2xl px-3.5 py-2 shadow-lg flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#E07A3F] truncate">
              {property.title}
            </span>
            <span className="text-xs font-semibold text-white truncate">
              {currentRoom.name}
              {currentPoint && roomPoints.length > 1 && (
                <span className="text-white/60 font-normal"> • {currentPoint.name}</span>
              )}
            </span>
          </div>
        </div>

        {/* Bottom Left: Etiqueta do ambiente atual + botão Planta + botão Música + botão Info */}
        <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 z-20 flex items-center flex-wrap gap-2 max-w-[85%] sm:max-w-xl pointer-events-auto">
          {/* Discreta etiqueta do ambiente atual */}
          <div className="bg-black/65 backdrop-blur-md text-white/95 border border-white/15 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#E07A3F] shrink-0" />
            <span className="font-semibold truncate max-w-[130px] sm:max-w-[200px]">
              {currentRoom.name}
            </span>
          </div>

          {/* Botão Detalhes/Info */}
          <Button
            size="sm"
            onClick={handleOpenInfo}
            className="bg-black/65 hover:bg-black/85 backdrop-blur-md text-white/90 hover:text-white border border-white/15 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5 h-8 sm:h-auto text-xs font-semibold"
            title="Ver detalhes do ambiente"
          >
            <Info className="w-3.5 h-3.5 text-[#E07A3F]" />
            <span className="hidden sm:inline">Ambiente</span>
          </Button>

          {/* Botão Planta discreto (visível apenas se o imóvel possui imagem de planta cadastrada) */}
          {property.floor_plan_image && (
            <Button
              size="sm"
              onClick={handleOpenFloorPlan}
              className="bg-black/65 hover:bg-black/85 backdrop-blur-md text-white/90 hover:text-white border border-white/15 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5 h-8 sm:h-auto text-xs font-semibold"
              title="Abrir planta interativa"
            >
              <Map className="w-3.5 h-3.5 text-[#E07A3F]" />
              <span className="hidden sm:inline">Planta</span>
            </Button>
          )}

          {/* Botão Som/Música de Fundo (visível apenas se o imóvel possui música cadastrada) */}
          {property.background_music && (
            <Button
              size="sm"
              onClick={toggleBackgroundMusic}
              className={cn(
                'backdrop-blur-md border rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5 h-8 sm:h-auto text-xs font-semibold transition-all',
                isAudioPlaying
                  ? 'bg-[#E07A3F]/85 hover:bg-[#E07A3F] text-white border-[#E07A3F]'
                  : 'bg-black/65 hover:bg-black/85 text-white/80 hover:text-white border-white/15',
              )}
              title={isAudioPlaying ? 'Desativar música de fundo' : 'Ativar música de fundo'}
              aria-label={isAudioPlaying ? 'Desativar música de fundo' : 'Ativar música de fundo'}
            >
              {isAudioPlaying ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-white animate-pulse" />
                  <span className="hidden sm:inline">Música ligada</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-white/70" />
                  <span className="hidden sm:inline">Música</span>
                </>
              )}
            </Button>
          )}

          {/* Botão Copiar Link */}
          <Button
            size="sm"
            onClick={handleShareTour}
            className="bg-black/65 hover:bg-black/85 backdrop-blur-md text-white/90 hover:text-white border border-white/15 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5 h-8 sm:h-auto text-xs font-semibold"
            title="Copiar link deste ponto"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline text-emerald-300">Copiado!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-[#E07A3F]" />
                <span className="hidden sm:inline">Copiar Link</span>
              </>
            )}
          </Button>

          {/* Botão WhatsApp */}
          <Button
            size="sm"
            onClick={handleWhatsAppClick}
            className="bg-[#25D366]/90 hover:bg-[#25D366] text-white border-0 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5 h-8 sm:h-auto text-xs font-semibold"
            title="Falar com corretor no WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">WhatsApp</span>
          </Button>
        </div>

        {/* Modal da Planta Interativa no Embed */}
        {property.floor_plan_image && (
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

                <div className="bg-[#FAF9F6] rounded-2xl p-3 border border-white/10 shadow-inner overflow-hidden mb-4 relative">
                  <div className="relative">
                    <img
                      src={propertiesService.getFileUrl(property, property.floor_plan_image)}
                      alt="Planta do Imóvel"
                      className="w-full h-auto rounded-lg object-contain"
                    />
                  </div>
                </div>

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
        )}

        {/* Modal de Informações do Ambiente no Embed */}
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

                {/* Seletor de Pontos do Cômodo Atual no Sheet */}
                {roomPoints.length > 1 && (
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wider text-white/50 font-bold">
                      Pontos de Visão Deste Cômodo ({roomPoints.length})
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {roomPoints.map((pt) => {
                        const isPtActive = pt.id === currentPoint?.id
                        return (
                          <button
                            key={pt.id}
                            type="button"
                            onClick={() => {
                              navigateToPoint(pt, currentRoom)
                              setInfoOpen(false)
                            }}
                            className={cn(
                              'w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-colors',
                              isPtActive
                                ? 'bg-[#E07A3F]/20 border-[#E07A3F] text-white font-bold'
                                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white',
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <Footprints className="w-3.5 h-3.5 text-[#E07A3F]" />
                              {pt.name}
                            </span>
                            {isPtActive && (
                              <Badge className="bg-[#E07A3F] text-[9px] h-4 px-1.5">Atual</Badge>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Seleção de Outros Cômodos no Sheet */}
                {rooms.length > 1 && (
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wider text-white/50 font-bold">
                      Navegar para Outro Cômodo
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {rooms.map((r) => {
                        const isCurrent = r.id === currentRoom.id
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              changeRoom(r.id)
                              setInfoOpen(false)
                            }}
                            className={cn(
                              'p-2 rounded-xl border text-left text-xs transition-colors',
                              isCurrent
                                ? 'bg-[#E07A3F] text-white font-bold border-[#E07A3F]'
                                : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white',
                            )}
                          >
                            <span className="truncate block">{r.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {currentRoom.description && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs uppercase tracking-wider text-white/50 font-bold">
                        Descrição do Espaço
                      </h4>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                      <p
                        ref={descRef}
                        className={cn(
                          'text-xs text-white/80 leading-relaxed break-words',
                          !isDescExpanded && 'line-clamp-4',
                        )}
                      >
                        {currentRoom.description}
                      </p>
                      {(isDescClamped || isDescExpanded) && (
                        <button
                          type="button"
                          onClick={() => setIsDescExpanded((prev) => !prev)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#E07A3F] hover:text-[#f2955d] transition-colors focus:outline-none"
                        >
                          <span>{isDescExpanded ? 'Ver menos' : 'Ver mais'}</span>
                          {isDescExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
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

  // ================= MODO PADRÃO (Página do site com cabeçalho, vitrine e rodapé) =================
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
            roomId={currentRoom.id}
            roomName={currentRoom.name}
            pointId={currentPoint?.id}
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

          {/* ===================== CONTROLES INTERNOS DA MOLDURA (LIMPOS E DISCRETOS) ===================== */}

          {/* Top-right: Botão discreto de TELA CHEIA (expandir/recolher moldura) */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
            {isFullscreenSupported && (
              <Button
                size="sm"
                onClick={toggleFullscreen}
                className="bg-black/60 hover:bg-black/85 backdrop-blur-md text-white/90 hover:text-white border border-white/10 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5 h-8 sm:h-9 transition-all text-xs"
                title={isFullscreen ? 'Recolher para moldura' : 'Expandir para tela cheia'}
                aria-label={isFullscreen ? 'Recolher para moldura' : 'Expandir para tela cheia'}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-[#E07A3F]" />
                    <span className="font-semibold hidden sm:inline">Recolher</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-[#E07A3F]" />
                    <span className="font-semibold hidden sm:inline">Tela cheia</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Bottom Left: Etiqueta DISCRETA e PEQUENA do ambiente atual (badge translúcido com blur, sem dropdown) + botão Planta */}
          <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 z-20 flex items-center gap-2 max-w-[80%] sm:max-w-md pointer-events-auto">
            {/* Discreta etiqueta do ambiente atual */}
            <div className="bg-black/65 backdrop-blur-md text-white/95 border border-white/15 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-[#E07A3F] shrink-0" />
              <span className="font-semibold truncate max-w-[150px] sm:max-w-[220px]">
                {currentRoom.name}
              </span>
              {currentPoint && roomPoints.length > 1 && (
                <span className="text-[11px] text-white/60 truncate border-l border-white/15 pl-2 max-w-[120px] sm:max-w-[160px] hidden sm:inline">
                  {currentPoint.name}
                </span>
              )}
            </div>

            {/* Botão Planta discreto (visível apenas se o imóvel possui imagem de planta cadastrada) */}
            {property.floor_plan_image && (
              <Button
                size="sm"
                onClick={handleOpenFloorPlan}
                className="bg-black/65 hover:bg-black/85 backdrop-blur-md text-white/90 hover:text-white border border-white/15 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5 h-8 sm:h-auto text-xs font-semibold"
                title="Abrir planta interativa"
              >
                <Map className="w-3.5 h-3.5 text-[#E07A3F]" />
                <span className="hidden sm:inline">Planta</span>
              </Button>
            )}

            {/* Botão Som/Música de Fundo (visível apenas se o imóvel possui música cadastrada) */}
            {property.background_music && (
              <Button
                size="sm"
                onClick={toggleBackgroundMusic}
                className={cn(
                  'backdrop-blur-md border rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5 h-8 sm:h-auto text-xs font-semibold transition-all',
                  isAudioPlaying
                    ? 'bg-[#E07A3F]/85 hover:bg-[#E07A3F] text-white border-[#E07A3F]'
                    : 'bg-black/65 hover:bg-black/85 text-white/80 hover:text-white border-white/15',
                )}
                title={isAudioPlaying ? 'Desativar música de fundo' : 'Ativar música de fundo'}
                aria-label={isAudioPlaying ? 'Desativar música de fundo' : 'Ativar música de fundo'}
              >
                {isAudioPlaying ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-white animate-pulse" />
                    <span className="hidden sm:inline">Música ligada</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-white/70" />
                    <span className="hidden sm:inline">Música</span>
                  </>
                )}
              </Button>
            )}
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

            {/* SELEÇÃO VERTICAL DE PONTOS DE VISÃO DO AMBIENTE ATUAL (Substitui barra horizontal sobre o panorama) */}
            {roomPoints.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/80 font-semibold flex items-center gap-1.5">
                    <Footprints className="w-3.5 h-3.5 text-[#E07A3F]" />
                    Pontos de visão do ambiente
                  </span>
                  <span className="text-[10px] text-white/50">
                    {roomPoints.length} {roomPoints.length === 1 ? 'ponto' : 'pontos'}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {roomPoints.map((pt) => {
                    const isActive = pt.id === currentPoint?.id
                    const ptPanoramaUrl = pt.panorama_image
                      ? navPointsService.getFileUrl(pt, pt.panorama_image)
                      : ''
                    const ptThumb = resolveNavPointImageUrl({
                      pointPanoramaUrl: ptPanoramaUrl,
                      roomPanoramaUrl,
                      roomName: currentRoom.name,
                      pointName: pt.name,
                    })

                    return (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => navigateToPoint(pt, currentRoom)}
                        className={cn(
                          'w-full flex items-center gap-3 p-2 rounded-2xl border text-left transition-all duration-200 group',
                          isActive
                            ? 'bg-[#E07A3F]/15 border-[#E07A3F] text-white shadow-md'
                            : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 hover:text-white',
                        )}
                      >
                        {/* Thumbnail miniatura do panorama do ponto */}
                        <div className="relative w-14 h-11 rounded-xl overflow-hidden shrink-0 border border-white/15 bg-black">
                          <img
                            src={ptThumb}
                            alt={pt.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          {isActive && (
                            <div className="absolute inset-0 bg-[#E07A3F]/30 flex items-center justify-center">
                              <span className="w-2 h-2 rounded-full bg-white ring-4 ring-[#E07A3F]" />
                            </div>
                          )}
                        </div>

                        {/* Informações do Ponto */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={cn(
                                'text-xs truncate block font-medium',
                                isActive ? 'font-bold text-white' : 'text-white/90',
                              )}
                            >
                              {pt.name}
                            </span>
                            {isActive && (
                              <Badge className="bg-[#E07A3F] text-white text-[9px] px-1.5 py-0 h-4 border-0">
                                Ativo
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-white/50 block truncate">
                            {pt.is_entry ? 'Ponto de entrada' : 'Ponto de observação'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Dimensões & Descrição */}
            <div className="space-y-2">
              {currentRoom.dimensions && (
                <div className="flex items-center justify-between text-xs text-white/80 bg-white/5 px-3 py-2 rounded-xl border border-white/10">
                  <span className="text-white/50">Dimensões:</span>
                  <span className="font-semibold text-white">{currentRoom.dimensions}</span>
                </div>
              )}

              {currentRoom.description && (
                <div className="bg-white/5 p-3 rounded-xl border border-white/10 transition-all duration-200">
                  <p
                    ref={descRef}
                    className={cn(
                      'text-xs text-white/70 leading-relaxed break-words',
                      !isDescExpanded && 'line-clamp-4',
                    )}
                  >
                    {currentRoom.description}
                  </p>
                  {(isDescClamped || isDescExpanded) && (
                    <button
                      type="button"
                      onClick={() => setIsDescExpanded((prev) => !prev)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#E07A3F] hover:text-[#f2955d] transition-colors focus:outline-none"
                    >
                      <span>{isDescExpanded ? 'Ver menos' : 'Ver mais'}</span>
                      {isDescExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Mini preview da Planta Ancorada no painel lateral (visível apenas se houver foto de planta enviada) */}
            {property.floor_plan_image && (
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
                  <img
                    src={propertiesService.getFileUrl(property, property.floor_plan_image)}
                    alt="Planta do Imóvel"
                    className="max-h-full max-w-full object-contain transition-transform group-hover/plan:scale-105"
                  />
                  <div className="absolute inset-0 bg-[#1C2B36]/20 opacity-0 group-hover/plan:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="bg-[#1C2B36]/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-full border border-white/20 shadow-md">
                      Abrir Planta
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* BOTÃO 'COMPARTILHAR ESTE AMBIENTE' (Item 4 do pacote aprovado) */}
            <div className="pt-1 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={handleShareTour}
                  variant="outline"
                  className="w-full border-[#E07A3F]/40 bg-[#E07A3F]/10 hover:bg-[#E07A3F]/20 text-white font-semibold py-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs h-auto"
                  title="Copiar link com parâmetros deste ambiente"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-[#E07A3F]" />
                      <span>Copiar link</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={handleShareOnWhatsApp}
                  variant="outline"
                  className="w-full border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-white font-semibold py-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs h-auto"
                  title="Compartilhar ambiente no WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Enviar WhatsApp</span>
                </Button>
              </div>

              {/* Botão de Contato com Corretor (verde oficial) */}
              <Button
                onClick={handleWhatsAppClick}
                className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold py-5 rounded-2xl shadow-lg transition-transform hover:scale-101 flex items-center justify-center gap-2 text-sm"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>Falar com corretor no WhatsApp</span>
              </Button>
            </div>
          </div>

          {/* Outros Ambientes do Imóvel (Navegação Rápida com Miniaturas no Painel) */}
          {rooms.length > 1 && (
            <div className="bg-[#1C2B36]/70 backdrop-blur-md rounded-3xl p-4 border border-white/10 text-xs text-white/80 space-y-2.5">
              <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold block">
                Outros ambientes
              </span>
              <div className="grid grid-cols-2 gap-2">
                {rooms.map((r) => {
                  const isCurrent = r.id === currentRoom.id
                  const rThumb = r.panorama_image
                    ? roomsService.getFileUrl(r, r.panorama_image)
                    : getRoomPanoramaUrl(r.name)
                  const rPoints = allNavPoints.filter((p) => p.room === r.id)

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => changeRoom(r.id)}
                      className={cn(
                        'relative rounded-xl overflow-hidden border text-left p-1.5 transition-all group flex flex-col justify-end h-16',
                        isCurrent
                          ? 'border-[#E07A3F] ring-1 ring-[#E07A3F]'
                          : 'border-white/10 hover:border-white/30 opacity-75 hover:opacity-100',
                      )}
                    >
                      <img
                        src={rThumb}
                        alt={r.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                      <span className="relative z-10 text-[10px] font-bold text-white leading-tight truncate">
                        {r.name}
                      </span>
                      {rPoints.length > 1 && (
                        <span className="relative z-10 text-[8px] text-white/60">
                          {rPoints.length} pontos
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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
      {property.floor_plan_image && (
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
                <div className="relative">
                  <img
                    src={propertiesService.getFileUrl(property, property.floor_plan_image)}
                    alt="Planta do Imóvel"
                    className="w-full h-auto rounded-lg object-contain"
                  />
                </div>
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
      )}

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
