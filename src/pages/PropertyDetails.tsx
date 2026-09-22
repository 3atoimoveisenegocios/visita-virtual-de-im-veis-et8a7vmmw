import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { propertiesService } from '@/services/properties'
import { roomsService } from '@/services/rooms'
import { interactionsService } from '@/services/interactions'
import { settingsService } from '@/services/settings'
import type { Property, Room, SiteSettings } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Compass,
  Bed,
  Bath,
  Car,
  Maximize2,
  MapPin,
  ArrowLeft,
  MessageCircle,
  Share2,
} from 'lucide-react'
import { toast } from 'sonner'

export default function PropertyDetails() {
  const { id } = useParams<{ id: string }>()
  const [property, setProperty] = useState<Property | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!id) return
      try {
        setLoading(true)
        const [prop, rms, siteSettings] = await Promise.all([
          propertiesService.getPropertyById(id),
          roomsService.getRoomsByProperty(id),
          settingsService.getSettings(),
        ])
        setProperty(prop)
        setRooms(rms)
        setSettings(siteSettings)
      } catch (err) {
        console.error('Erro ao buscar dados:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()

    const onSettingsUpdated = (e: any) => {
      if (e?.detail) setSettings(e.detail)
    }
    window.addEventListener('settings-updated', onSettingsUpdated)
    return () => {
      window.removeEventListener('settings-updated', onSettingsUpdated)
    }
  }, [id])

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const handleWhatsAppClick = () => {
    if (property) {
      interactionsService.recordInteraction(property.id, 'whatsapp_clicked')
    }
    window.open('https://wa.me/551144227729', '_blank', 'noopener,noreferrer')
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: property?.title || 'Visita Virtual de Imóvel',
        text: `Confira este imóvel com visita virtual 360°!`,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link copiado para a área de transferência!')
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-16 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4 mb-6" />
        <div className="h-96 bg-slate-200 rounded-2xl mb-8" />
        <div className="h-40 bg-slate-200 rounded-2xl" />
      </div>
    )
  }

  if (!property) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4 text-[#1C2B36]">Imóvel não encontrado</h2>
        <p className="text-[#5B6B76] mb-6">Este imóvel pode ter sido despublicado ou excluído.</p>
        <Button asChild className="bg-[#1F4E5F] text-white">
          <Link to="/">Voltar para a página inicial</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
      {/* Back button & Actions bar */}
      <div className="flex items-center justify-between mb-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-[#5B6B76] hover:text-[#1C2B36] hover:bg-slate-200/50"
        >
          <Link to="/" className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar aos imóveis</span>
          </Link>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="border-[#E2E6E9] text-[#1C2B36] hover:bg-slate-100"
        >
          <Share2 className="w-4 h-4 mr-2 text-[#1F4E5F]" />
          Compartilhar
        </Button>
      </div>

      {/* Main Title & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-[#5B6B76] text-sm mb-2">
            <MapPin className="w-4 h-4 text-[#E07A3F]" />
            <span>
              {property.neighborhood}, {property.city}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1C2B36] tracking-tight">
            {property.title}
          </h1>
        </div>

        <div className="flex flex-col md:items-end">
          <span className="text-xs uppercase text-[#5B6B76] font-semibold tracking-wider">
            Valor de Venda
          </span>
          <div className="text-3xl sm:text-4xl font-extrabold text-[#1F4E5F]">
            {formatPrice(property.price)}
          </div>
        </div>
      </div>

      {/* Hero CTA Box to launch 360° tour */}
      <div className="relative rounded-3xl overflow-hidden bg-[#1C2B36] mb-12 shadow-xl border border-[#1F4E5F]">
        <div
          className="h-80 sm:h-96 bg-cover bg-center transition-transform duration-700 hover:scale-105"
          style={{
            backgroundImage: `url('https://pannellum.org/images/alma.jpg')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6 sm:p-10">
          <Badge className="bg-[#E07A3F] text-white self-start mb-3 px-3 py-1 font-semibold uppercase tracking-wider text-xs">
            Experiência Virtual
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Faça a Visita Virtual 360° Completa
          </h2>
          <p className="text-white/80 max-w-xl text-sm sm:text-base mb-6">
            Explore todos os cômodos com visualização 360°, alterne os ambientes pelos hotspots da
            porta ou pela planta interativa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              asChild
              size="lg"
              className="bg-[#E07A3F] hover:bg-[#d06d33] text-white font-bold text-base px-8 py-6 rounded-xl shadow-lg hover:shadow-2xl transition-transform active:scale-95"
            >
              <Link to={`/visita/${property.id}`}>
                <Compass className="w-5 h-5 mr-2" />
                Iniciar Visita Virtual 360°
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              className="bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-base px-6 py-6 rounded-xl shadow-md"
            >
              <a
                href="https://wa.me/551144227729"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (property) {
                    interactionsService.recordInteraction(property.id, 'whatsapp_clicked')
                  }
                }}
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Fale com o corretor
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Gallery of Rooms (Horizontal Scrollable Strip) */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-[#1C2B36]">
              Ambientes do Imóvel ({rooms.length})
            </h3>
            <p className="text-xs text-[#5B6B76]">
              Clique em qualquer ambiente para abrir o tour 360° direto nele
            </p>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x no-scrollbar">
          {rooms.map((r) => {
            const thumbUrl = r.panorama_image
              ? roomsService.getFileUrl(r, r.panorama_image)
              : 'https://pannellum.org/images/alma.jpg'

            return (
              <Link
                key={r.id}
                to={`/visita/${property.id}?ambiente=${r.id}`}
                className="group flex-shrink-0 w-64 snap-start bg-white rounded-xl overflow-hidden border border-[#E2E6E9] shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
              >
                <div className="relative h-36 bg-[#1C2B36] overflow-hidden">
                  <img
                    src={thumbUrl}
                    alt={r.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1.5 text-white">
                    <Compass className="w-3.5 h-3.5 text-[#E07A3F]" />
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-bold text-sm text-[#1C2B36] group-hover:text-[#1F4E5F] truncate">
                    {r.name}
                  </h4>
                  {r.dimensions && (
                    <span className="text-xs text-[#5B6B76] block mt-0.5">{r.dimensions}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Property Features Grid & Description */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className="md:col-span-2 space-y-8">
          {/* Features Grid */}
          <Card className="border-[#E2E6E9] shadow-sm bg-white">
            <CardContent className="p-6">
              <h3 className="font-bold text-base text-[#1C2B36] mb-4">Características do Imóvel</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {property.area_m2 ? (
                  <div className="p-4 rounded-xl bg-[#F7F5F2] border border-[#E2E6E9] flex flex-col items-center text-center">
                    <Maximize2 className="w-6 h-6 text-[#1F4E5F] mb-1.5" />
                    <span className="text-lg font-bold text-[#1C2B36]">{property.area_m2} m²</span>
                    <span className="text-xs text-[#5B6B76]">Área privativa</span>
                  </div>
                ) : null}

                {property.bedrooms ? (
                  <div className="p-4 rounded-xl bg-[#F7F5F2] border border-[#E2E6E9] flex flex-col items-center text-center">
                    <Bed className="w-6 h-6 text-[#1F4E5F] mb-1.5" />
                    <span className="text-lg font-bold text-[#1C2B36]">{property.bedrooms}</span>
                    <span className="text-xs text-[#5B6B76]">Quartos</span>
                  </div>
                ) : null}

                {property.bathrooms ? (
                  <div className="p-4 rounded-xl bg-[#F7F5F2] border border-[#E2E6E9] flex flex-col items-center text-center">
                    <Bath className="w-6 h-6 text-[#1F4E5F] mb-1.5" />
                    <span className="text-lg font-bold text-[#1C2B36]">{property.bathrooms}</span>
                    <span className="text-xs text-[#5B6B76]">Banheiros</span>
                  </div>
                ) : null}

                {property.parking_spots ? (
                  <div className="p-4 rounded-xl bg-[#F7F5F2] border border-[#E2E6E9] flex flex-col items-center text-center">
                    <Car className="w-6 h-6 text-[#1F4E5F] mb-1.5" />
                    <span className="text-lg font-bold text-[#1C2B36]">
                      {property.parking_spots}
                    </span>
                    <span className="text-xs text-[#5B6B76]">Vagas de garagem</span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          {property.description && (
            <Card className="border-[#E2E6E9] shadow-sm bg-white">
              <CardContent className="p-6">
                <h3 className="font-bold text-base text-[#1C2B36] mb-3">Descrição</h3>
                <p className="text-sm text-[#5B6B76] leading-relaxed whitespace-pre-line">
                  {property.description}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sticky Sidebar Contact Card */}
        <div className="space-y-6">
          <Card className="border-[#E2E6E9] shadow-md bg-white sticky top-24">
            <CardContent className="p-6">
              <div className="text-center pb-6 border-b border-[#E2E6E9]">
                {settings?.agency_logo ? (
                  <div className="w-16 h-16 rounded-full bg-white border border-[#E2E6E9] shadow-sm flex items-center justify-center mx-auto mb-3 overflow-hidden p-1">
                    <img
                      src={settingsService.getFileUrl(settings, settings.agency_logo)}
                      alt="Logo da Imobiliária"
                      className="w-full h-full object-contain rounded-full"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#1F4E5F] text-white flex items-center justify-center mx-auto mb-3 text-xl font-bold shadow-sm">
                    3A
                  </div>
                )}
                <h4 className="font-bold text-lg text-[#1C2B36]">3° ATO IMÓVEIS E NEGÓCIOS</h4>
                <p className="text-xs text-[#5B6B76]">CRECI: 50383-J</p>
              </div>

              <div className="py-6 space-y-3">
                <Button
                  asChild
                  className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-6 rounded-xl shadow-md text-base"
                >
                  <a
                    href="https://wa.me/551144227729"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (property) {
                        interactionsService.recordInteraction(property.id, 'whatsapp_clicked')
                      }
                    }}
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Chamar no Whatsapp
                  </a>
                </Button>

                <Button
                  asChild
                  className="w-full bg-[#1F4E5F] hover:bg-[#18404E] text-white font-semibold py-6 rounded-xl shadow-sm"
                >
                  <Link to={`/visita/${property.id}`}>
                    <Compass className="w-5 h-5 mr-2 text-[#E07A3F]" />
                    Fazer Visita 360° Agora
                  </Link>
                </Button>
              </div>

              <p className="text-[11px] text-[#5B6B76] text-center leading-normal">
                Visita virtual disponível 24h por dia sem necessidade de agendamento ou cadastro.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
