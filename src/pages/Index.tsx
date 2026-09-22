import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { propertiesService } from '@/services/properties'
import { roomsService } from '@/services/rooms'
import type { Property, Room } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Compass,
  Bed,
  Bath,
  Car,
  Maximize2,
  ChevronDown,
  ArrowRight,
  Eye,
  MapPin,
} from 'lucide-react'

export default function Index() {
  const [properties, setProperties] = useState<Property[]>([])
  const [firstRooms, setFirstRooms] = useState<Record<string, Room>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const props = await propertiesService.getPublishedProperties()
        setProperties(props)

        // Fetch first room for each property for cover thumbnail
        const roomsMap: Record<string, Room> = {}
        for (const p of props) {
          const rooms = await roomsService.getRoomsByProperty(p.id)
          if (rooms.length > 0) {
            roomsMap[p.id] = rooms[0]
          }
        }
        setFirstRooms(roomsMap)
      } catch (err) {
        console.error('Erro ao carregar imóveis:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const scrollToProperties = () => {
    document.getElementById('imoveis-grid')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center text-center overflow-hidden bg-[#1C2B36]">
        {/* Background photo & dark gradient */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url('https://pannellum.org/images/alma.jpg')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1C2B36] via-[#1C2B36]/80 to-[#1C2B36]/60 backdrop-blur-[2px]" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-20 flex flex-col items-center">
          <Badge className="bg-[#E07A3F] hover:bg-[#d06d33] text-white text-xs font-semibold px-3 py-1 mb-6 rounded-full uppercase tracking-wider animate-fade-in shadow-md">
            Tecnologia Imersiva 360°
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6 font-['Inter']">
            Explore imóveis em <span className="text-[#E07A3F]">360°</span> como se estivesse lá
          </h1>

          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mb-10 font-normal leading-relaxed">
            Navegue por cada cômodo livremente, examine os detalhes em alta resolução e sinta a
            verdadeira dimensão de cada espaço antes da visita presencial.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Button
              size="lg"
              onClick={scrollToProperties}
              className="bg-[#E07A3F] hover:bg-[#d06d33] text-white text-base px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all font-semibold"
            >
              <Compass className="w-5 h-5 mr-2" />
              Ver Imóveis Disponíveis
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm text-base px-6 py-6 rounded-xl"
            >
              <Link to="/admin">Área do Corretor</Link>
            </Button>
          </div>

          {/* Scroll Down Indicator */}
          <button
            onClick={scrollToProperties}
            aria-label="Rolar para baixo"
            className="mt-16 text-white/70 hover:text-white flex flex-col items-center gap-1 animate-bounce cursor-pointer transition-colors"
          >
            <span className="text-xs uppercase tracking-widest font-medium">Conhecer</span>
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Property Cards Section */}
      <section id="imoveis-grid" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 text-[#E07A3F] font-semibold text-sm uppercase tracking-wider mb-2">
              <Compass className="w-4 h-4" />
              <span>Visitas Virtuais Disponíveis</span>
            </div>
            <h2 className="text-3xl font-bold text-[#1C2B36] tracking-tight">
              Imóveis em Destaque
            </h2>
          </div>
          <p className="text-sm text-[#5B6B76] mt-2 md:mt-0">
            {properties.length}{' '}
            {properties.length === 1 ? 'imóvel disponível' : 'imóveis disponíveis'} para tour 360°
          </p>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E2E6E9] animate-pulse"
              >
                <div className="h-64 bg-slate-200" />
                <div className="p-6 space-y-4">
                  <div className="h-6 bg-slate-200 rounded w-3/4" />
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                  <div className="h-8 bg-slate-200 rounded w-1/3" />
                  <div className="h-10 bg-slate-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && properties.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center border border-[#E2E6E9] shadow-sm max-w-xl mx-auto my-8">
            <div className="w-16 h-16 bg-[#1F4E5F]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#1F4E5F]">
              <Compass className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#1C2B36] mb-2">Nenhum imóvel publicado ainda</h3>
            <p className="text-[#5B6B76] text-sm mb-6 leading-relaxed">
              Os corretores e administradores podem cadastrar imóveis e montar tours 360° no Painel
              Admin.
            </p>
            <Button asChild className="bg-[#1F4E5F] hover:bg-[#18404E] text-white">
              <Link to="/admin">Acessar Painel Admin</Link>
            </Button>
          </div>
        )}

        {/* Property Cards Grid */}
        {!loading && properties.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {properties.map((prop, idx) => {
              const firstRoom = firstRooms[prop.id]
              const coverUrl = firstRoom?.panorama_image
                ? propertiesService.getFileUrl(firstRoom, firstRoom.panorama_image)
                : 'https://pannellum.org/images/alma.jpg'

              return (
                <Card
                  key={prop.id}
                  className="group bg-white rounded-2xl overflow-hidden border border-[#E2E6E9] shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  {/* Card Cover Image with Zoom Effect */}
                  <div className="relative h-64 overflow-hidden bg-[#1C2B36]">
                    <img
                      src={coverUrl}
                      alt={prop.title}
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                    <Badge className="absolute top-4 left-4 bg-[#1F4E5F]/90 backdrop-blur-md text-white font-semibold flex items-center gap-1.5 px-3 py-1 shadow-sm">
                      <Compass className="w-3.5 h-3.5 text-[#E07A3F]" />
                      <span>Tour 360° Ativo</span>
                    </Badge>

                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <div className="flex items-center gap-1.5 text-xs text-white/80 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-[#E07A3F]" />
                        <span>
                          {prop.neighborhood}, {prop.city}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold leading-tight group-hover:text-white transition-colors">
                        {prop.title}
                      </h3>
                    </div>
                  </div>

                  {/* Card Content & Features */}
                  <CardContent className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Price Tag */}
                      <div className="mb-4">
                        <span className="text-xs uppercase text-[#5B6B76] font-semibold tracking-wider">
                          Valor de Venda
                        </span>
                        <div className="text-2xl font-extrabold text-[#1F4E5F]">
                          {formatPrice(prop.price)}
                        </div>
                      </div>

                      {/* Property Amenities Grid */}
                      <div className="grid grid-cols-4 gap-2 py-3 border-y border-[#E2E6E9] mb-5 text-center text-xs text-[#5B6B76]">
                        {prop.bedrooms ? (
                          <div className="flex flex-col items-center">
                            <Bed className="w-4 h-4 mb-1 text-[#1F4E5F]" />
                            <span className="font-semibold text-[#1C2B36]">{prop.bedrooms}</span>
                            <span>Quartos</span>
                          </div>
                        ) : null}
                        {prop.bathrooms ? (
                          <div className="flex flex-col items-center">
                            <Bath className="w-4 h-4 mb-1 text-[#1F4E5F]" />
                            <span className="font-semibold text-[#1C2B36]">{prop.bathrooms}</span>
                            <span>Banh.</span>
                          </div>
                        ) : null}
                        {prop.parking_spots ? (
                          <div className="flex flex-col items-center">
                            <Car className="w-4 h-4 mb-1 text-[#1F4E5F]" />
                            <span className="font-semibold text-[#1C2B36]">
                              {prop.parking_spots}
                            </span>
                            <span>Vagas</span>
                          </div>
                        ) : null}
                        {prop.area_m2 ? (
                          <div className="flex flex-col items-center">
                            <Maximize2 className="w-4 h-4 mb-1 text-[#1F4E5F]" />
                            <span className="font-semibold text-[#1C2B36]">{prop.area_m2} m²</span>
                            <span>Área</span>
                          </div>
                        ) : null}
                      </div>

                      {prop.description && (
                        <p className="text-xs text-[#5B6B76] line-clamp-2 mb-4 leading-relaxed">
                          {prop.description}
                        </p>
                      )}
                    </div>

                    {/* Actions: Start Tour + Details */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                      <Button
                        asChild
                        className="w-full sm:flex-1 bg-[#E07A3F] hover:bg-[#d06d33] text-white font-semibold py-5 shadow-sm transition-transform active:scale-95"
                      >
                        <Link to={`/visita/${prop.id}`}>
                          <Compass className="w-4 h-4 mr-2" />
                          Ver Visita 360°
                        </Link>
                      </Button>

                      <Button
                        asChild
                        variant="ghost"
                        className="w-full sm:w-auto text-[#1F4E5F] hover:bg-[#1F4E5F]/10 text-xs font-semibold"
                      >
                        <Link to={`/imovel/${prop.id}`} className="flex items-center gap-1">
                          <span>Ver detalhes</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
