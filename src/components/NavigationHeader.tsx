import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { settingsService } from '@/services/settings'
import type { SiteSettings, LogoSize } from '@/types'
import { Compass, ExternalLink, Menu, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface NavigationHeaderProps {
  siteSettings: SiteSettings | null
}

interface NavLinkItem {
  label: string
  href: string
  isExternal?: boolean
  isPill?: boolean
  primary?: boolean
}

const MENU_ITEMS: NavLinkItem[] = [
  {
    label: 'Home',
    href: '/',
    isExternal: false,
    isPill: false,
  },
  {
    label: 'Site Principal',
    href: 'https://3atoimoveis.com.br/',
    isExternal: true,
    isPill: false,
  },
  {
    label: 'Cadastre seu Imóvel',
    href: 'https://cadastreseuimovel.3atoimoveis.com.br/',
    isExternal: true,
    isPill: true,
  },
  {
    label: 'Portal do Cliente',
    href: 'https://portaldocliente.3atoimoveis.com.br/login',
    isExternal: true,
    isPill: true,
    primary: true,
  },
]

export function NavigationHeader({ siteSettings }: NavigationHeaderProps) {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Quando estiver na home, a barra começa transparente e transiciona após rolar 24px
      setScrolled(window.scrollY > 24)
    }

    // Checagem imediata caso a página já inicie rolada
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Na Home: se não rolado, transparente sobre o hero escuro com texto branco.
  // Se rolado: barra sólida com desfoque de fundo (backdrop-blur) e leve sombra.
  // Fora da Home: barra sólida consistente para ótima legibilidade.
  const isTransparent = isHome && !scrolled

  const logoUrl = siteSettings?.logo
    ? settingsService.getFileUrl(siteSettings, siteSettings.logo)
    : null

  const logoSizeClass = settingsService.getLogoSizeClass(
    (siteSettings?.logo_size as LogoSize) || 'medio',
  )

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out',
        isTransparent
          ? 'bg-transparent border-b border-white/10 py-3 sm:py-4'
          : 'bg-[#1C2B36]/95 backdrop-blur-md border-b border-white/10 shadow-lg py-2.5 sm:py-3',
      )}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo / Marca da 3° ATO */}
        <Link
          to="/"
          className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A3F] rounded-lg py-1 transition-transform"
          aria-label="3° ATO Imóveis - Início"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={siteSettings?.site_title || '3° ATO Imóveis e Negócios'}
              className={cn(
                'object-contain transition-transform duration-300 group-hover:scale-105',
                logoSizeClass,
              )}
            />
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1F4E5F] to-[#143743] flex items-center justify-center text-white shadow-md border border-white/10 transition-transform duration-300 group-hover:scale-105 flex-shrink-0">
                <Compass className="w-5 h-5 text-[#E07A3F]" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight leading-none text-white drop-shadow-sm">
                  3° ATO
                </span>
                <span className="text-[10px] tracking-wider uppercase text-white/75 font-semibold mt-0.5">
                  Imóveis & Negócios
                </span>
              </div>
            </div>
          )}
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          className="hidden md:flex items-center gap-2 lg:gap-3"
          aria-label="Navegação Principal"
        >
          {MENU_ITEMS.map((item) => {
            if (!item.isPill) {
              // Links discretos de texto com sublinhado animado no hover
              const isCurrent = !item.isExternal && location.pathname === item.href

              if (item.isExternal) {
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative group px-3.5 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A3F] rounded-md"
                  >
                    <span>{item.label}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    {/* Animated underline */}
                    <span className="absolute bottom-1 left-3.5 right-3.5 h-[2px] bg-[#E07A3F] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
                  </a>
                )
              }

              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={cn(
                    'relative group px-3.5 py-2 text-sm font-medium transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A3F] rounded-md',
                    isCurrent ? 'text-white font-semibold' : 'text-white/90 hover:text-white',
                  )}
                >
                  <span>{item.label}</span>
                  {/* Animated underline */}
                  <span
                    className={cn(
                      'absolute bottom-1 left-3.5 right-3.5 h-[2px] bg-[#E07A3F] transition-transform duration-300 origin-left rounded-full',
                      isCurrent ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                    )}
                  />
                </Link>
              )
            }

            // Botões-pílula com borda fina translúcida que preenchem suavemente no hover
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'group inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs lg:text-sm font-semibold transition-all duration-300 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  item.primary
                    ? 'bg-[#1F4E5F]/80 hover:bg-[#1F4E5F] text-white border border-[#30687d]/80 hover:border-[#418ba6] hover:shadow-md hover:shadow-[#1F4E5F]/30 focus-visible:ring-[#1F4E5F]'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/25 hover:border-white/40 hover:shadow-md focus-visible:ring-white',
                )}
              >
                <span>{item.label}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            )
          })}
        </nav>

        {/* Mobile Hamburger Button & Drawer */}
        <div className="flex md:hidden items-center gap-2">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A3F] transition-colors"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[300px] sm:w-[360px] bg-[#1C2B36] text-white border-l border-white/10 p-0 flex flex-col justify-between"
            >
              <div>
                <SheetHeader className="p-6 border-b border-white/10 text-left flex flex-row items-center justify-between">
                  <SheetTitle className="text-white text-lg font-bold flex items-center gap-2">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="3° ATO"
                        className="max-h-8 max-w-[150px] object-contain"
                      />
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-lg bg-[#1F4E5F] flex items-center justify-center text-white">
                          <Compass className="w-4 h-4 text-[#E07A3F]" />
                        </div>
                        <span>3° ATO Imóveis</span>
                      </>
                    )}
                  </SheetTitle>
                </SheetHeader>

                <nav className="p-6 flex flex-col gap-3" aria-label="Menu Mobile">
                  {/* Item 1: Home */}
                  <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center justify-between p-3.5 rounded-xl text-base font-semibold transition-all',
                      location.pathname === '/'
                        ? 'bg-[#1F4E5F] text-white'
                        : 'text-white/90 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <span>Home</span>
                  </Link>

                  {/* Item 2: Site Principal */}
                  <a
                    href="https://3atoimoveis.com.br/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-3.5 rounded-xl text-base font-semibold text-white/90 hover:bg-white/10 hover:text-white transition-all"
                  >
                    <span>Site Principal</span>
                    <ExternalLink className="w-4 h-4 text-white/50" />
                  </a>

                  <div className="pt-3 pb-1">
                    <div className="h-px bg-white/10" />
                  </div>

                  {/* Item 3: Cadastre seu Imóvel */}
                  <a
                    href="https://cadastreseuimovel.3atoimoveis.com.br/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-3.5 rounded-xl text-base font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-sm"
                  >
                    <span>Cadastre seu Imóvel</span>
                    <ExternalLink className="w-4 h-4 text-[#E07A3F]" />
                  </a>

                  {/* Item 4: Portal do Cliente */}
                  <a
                    href="https://portaldocliente.3atoimoveis.com.br/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-3.5 rounded-xl text-base font-semibold bg-gradient-to-r from-[#1F4E5F] to-[#276479] hover:from-[#19404e] hover:to-[#1F4E5F] text-white border border-[#30687d] transition-all shadow-md"
                  >
                    <span>Portal do Cliente</span>
                    <ExternalLink className="w-4 h-4 text-[#E07A3F]" />
                  </a>
                </nav>
              </div>

              {/* Mobile Drawer Footer with Contact Info */}
              <div className="p-6 border-t border-white/10 bg-black/20 text-xs text-white/60 space-y-2">
                <p className="font-semibold text-white/80">3° ATO IMÓVEIS E NEGÓCIOS</p>
                <p>CRECI: 50383-J</p>
                <a
                  href="https://wa.me/551144227729"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[#25D366] hover:underline font-medium"
                >
                  WhatsApp: (11) 4422-7729
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
