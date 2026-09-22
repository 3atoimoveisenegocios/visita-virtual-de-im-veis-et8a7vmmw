import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { propertiesService } from '@/services/properties'
import { roomsService } from '@/services/rooms'
import { hotspotsService } from '@/services/hotspots'
import { interactionsService } from '@/services/interactions'
import type { Property, Room, Hotspot } from '@/types'
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
} from 'lucide-react'
import { toast } from 'sonner'

export default function VirtualTour() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [property, setProperty] = useState<Property | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [currentHotspots, setCurrentHotspots] = useState<Hotspot[]>([])

  // Panels state
  const [floorPlanOpen, setFloorPlanOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  // Transition state: fade-to-black 300ms
  const [isTransitioning, setIsTransitioning] = useState(false)
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
          // Check query param ?ambiente=
          const requestedRoomId = searchParams.get('ambiente')
          const initial = rms.find((r) => r.id === requestedRoomId) || rms[0]
          setCurrentRoom(initial)

          // Record room visited
          interactionsService.recordInteraction(id, 'room_visited', initial.id)

          // Fetch hotspots
          const hs = await hotspotsService.getHotspotsByRoom(initial.id)
          setCurrentHotspots(hs)
        }
      } catch (err) {
        console.error('Erro ao iniciar tour virtual:', err)
      } finally {
        setLoading(false)
      }
    }
    initTour()
  }, [id, searchParams])

  // Transition to another room with smooth 300ms fade-to-black
  const changeRoom = useCallback(
    async (targetRoomId: string) => {
      if (!property || !targetRoomId || targetRoomId === currentRoom?.id) return

      setIsTransitioning(true)

      // Record room change
      interactionsService.recordInteraction(property.id, 'room_visited', targetRoomId)

      // Fade out for 300ms
      setTimeout(async () => {
        const nextRoom = rooms.find((r) => r.id === targetRoomId)
        if (nextRoom) {
          setCurrentRoom(nextRoom)
          setSearchParams({ ambiente: nextRoom.id })

          // Load hotspots for the next room
          try {
            const hs = await hotspotsService.getHotspotsByRoom(nextRoom.id)
            setCurrentHotspots(hs)
          } catch (e) {
            console.error('Erro ao buscar hotspots:', e)
          }
        }
        // Fade back in
        setTimeout(() => {
          setIsTransitioning(false)
        }, 150)
      }, 300)
    },
    [property, currentRoom, rooms, setSearchParams],
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

  // Get active panorama URL
  const uploadedPanoramaUrl = currentRoom.panorama_image
    ? roomsService.getFileUrl(currentRoom, currentRoom.panorama_image)
    : ''
  const panoramaUrl = getRoomPanoramaUrl(currentRoom.name, uploadedPanoramaUrl)

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-['Inter']">
      {/* 360° Panorama Viewer */}
      <PanoramaViewer
        imageUrl={panoramaUrl}
        roomName={currentRoom.name}
        hotspots={currentHotspots}
        onHotspotClick={changeRoom}
        isLoading={isTransitioning}
      />

      {/* Fade-to-black Transition Overlay (300ms) */}
      <div
        className={`absolute inset-0 bg-black pointer-events-none transition-opacity duration-300 z-30 ${
          isTransitioning ? 'opacity-100' : 'opacity-0'
        }`}
      />

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
              <span className="text-xs font-bold truncate max-w-[150px] sm:max-w-[200px]">
                {currentRoom.name}
              </span>
              <ChevronDown className="w-4 h-4 text-white/60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-[#1C2B36]/95 backdrop-blur-md text-white border-white/10 p-1.5 rounded-xl shadow-2xl"
          >
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-white/50 font-bold">
              Ambientes do imóvel
            </div>
            {rooms.map((r) => (
              <DropdownMenuItem
                key={r.id}
                onClick={() => changeRoom(r.id)}
                className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  r.id === currentRoom.id
                    ? 'bg-[#E07A3F] text-white font-bold'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {r.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bottom Center: Horizontal Room Thumbnail Strip */}
      <div className="absolute bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 max-w-[90vw] sm:max-w-2xl">
        <div className="bg-[rgba(15,23,32,0.72)] backdrop-blur-md border border-white/10 rounded-2xl p-2 shadow-2xl flex items-center gap-2 overflow-x-auto no-scrollbar">
          {rooms.map((r) => {
            const isSelected = r.id === currentRoom.id
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

            {/* Floor Plan Display */}
            <div className="bg-[#FAF9F6] rounded-2xl p-3 border border-white/10 shadow-inner overflow-hidden mb-6 relative">
              {property.floor_plan_image ? (
                <div className="relative">
                  <img
                    src={propertiesService.getFileUrl(property, property.floor_plan_image)}
                    alt="Planta do Imóvel"
                    className="w-full h-auto rounded-lg object-contain"
                  />
                </div>
              ) : (
                <div
                  className="w-full h-64 rounded-lg overflow-hidden flex items-center justify-center"
                  dangerouslySetInnerHTML={{
                    __html: generateDemoFloorPlan(
                      property.title,
                      rooms.map((r) => ({ id: r.id, name: r.name })),
                    ),
                  }}
                />
              )}
            </div>

            {/* Room Jump List from Floor Plan */}
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-white/50 font-bold mb-1">
                Selecione o cômodo
              </div>
              <div className="grid grid-cols-1 gap-2">
                {rooms.map((r) => {
                  const isActive = r.id === currentRoom.id
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        changeRoom(r.id)
                        setFloorPlanOpen(false)
                      }}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs transition-colors border ${
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
              {/* Room Name Badge */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-[#E07A3F] font-bold mb-1">
                  Ambiente Atual
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{currentRoom.name}</h3>
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
