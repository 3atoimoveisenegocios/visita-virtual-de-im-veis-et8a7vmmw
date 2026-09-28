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
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Barra branca sólida sempre; aprofunda a sombra suavemente após rolar 16px
      setScrolled(window.scrollY > 16)
    }

    // Checagem imediata caso a página já inicie rolada
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const logoUrl = siteSettings?.logo
    ? settingsService.getFileUrl(siteSettings, siteSettings.logo)
    : null

  const logoSizeClass = settingsService.getLogoSizeClass(
    (siteSettings?.logo_size as LogoSize) || 'medio',
  )

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-white border-b border-neutral-200/80 transition-all duration-300 ease-in-out',
        scrolled
          ? 'py-2.5 sm:py-3 shadow-[0_4px_24px_rgba(0,0,0,0.10)]'
          : 'py-3 sm:py-3.5 shadow-[0_2px_16px_rgba(0,0,0,0.06)]',
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1F4E5F] to-[#143743] flex items-center justify-center text-white shadow-md border border-neutral-200 transition-transform duration-300 group-hover:scale-105 flex-shrink-0">
                <Compass className="w-5 h-5 text-[#E07A3F]" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight leading-none text-neutral-900 drop-shadow-sm">
                  3° ATO
                </span>
                <span className="text-[10px] tracking-wider uppercase text-neutral-500 font-semibold mt-0.5">
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
              // Links de texto em preto/grafite com sublinhado animado no hover em terracota (#E07A3F)
              const isCurrent = !item.isExternal && location.pathname === item.href

              if (item.isExternal) {
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative group px-3.5 py-2 text-sm font-semibold text-neutral-900 hover:text-black transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A3F] rounded-md"
                  >
                    <span>{item.label}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-900 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    {/* Animated underline terracota (#E07A3F) */}
                    <span className="absolute bottom-1 left-3.5 right-3.5 h-[2px] bg-[#E07A3F] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
                  </a>
                )
              }

              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={cn(
                    'relative group px-3.5 py-2 text-sm font-semibold transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A3F] rounded-md',
                    isCurrent ? 'text-neutral-950 font-bold' : 'text-neutral-900 hover:text-black',
                  )}
                >
                  <span>{item.label}</span>
                  {/* Animated underline terracota (#E07A3F) */}
                  <span
                    className={cn(
                      'absolute bottom-1 left-3.5 right-3.5 h-[2px] bg-[#E07A3F] transition-transform duration-300 origin-left rounded-full',
                      isCurrent ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                    )}
                  />
                </Link>
              )
            }

            // Botões-pílula pretos (bg-neutral-900, text-white), cantos arredondados, sombra básica, hover suave.
            // "Portal do Cliente" com borda fina terracota (#E07A3F) para destaque.
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'group inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs lg:text-sm font-semibold text-white transition-all duration-300 shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 hover:-translate-y-0.5 active:translate-y-0',
                  item.primary
                    ? 'bg-neutral-900 hover:bg-black border border-[#E07A3F] hover:border-[#E07A3F] shadow-sm hover:shadow-[0_4px_12px_rgba(224,122,63,0.25)]'
                    : 'bg-neutral-900 hover:bg-black border border-neutral-800 hover:border-neutral-700',
                )}
              >
                <span>{item.label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-neutral-300 group-hover:text-white transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
                className="p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A3F] transition-colors shadow-xs"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[300px] sm:w-[360px] bg-white text-neutral-900 border-l border-neutral-200 p-0 flex flex-col justify-between shadow-2xl"
            >
              <div>
                <SheetHeader className="p-6 border-b border-neutral-200/80 text-left flex flex-row items-center justify-between">
                  <SheetTitle className="text-neutral-900 text-lg font-bold flex items-center gap-2">
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
                        ? 'bg-neutral-100 text-neutral-950 font-bold border-l-4 border-[#E07A3F]'
                        : 'text-neutral-900 hover:bg-neutral-100 hover:text-black',
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
                    className="flex items-center justify-between p-3.5 rounded-xl text-base font-semibold text-neutral-900 hover:bg-neutral-100 hover:text-black transition-all"
                  >
                    <span>Site Principal</span>
                    <ExternalLink className="w-4 h-4 text-neutral-500" />
                  </a>

                  <div className="pt-3 pb-1">
                    <div className="h-px bg-neutral-200" />
                  </div>

                  {/* Item 3: Cadastre seu Imóvel */}
                  <a
                    href="https://cadastreseuimovel.3atoimoveis.com.br/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-3.5 rounded-full text-base font-semibold bg-neutral-900 hover:bg-black text-white border border-neutral-800 transition-all shadow-sm px-5"
                  >
                    <span>Cadastre seu Imóvel</span>
                    <ExternalLink className="w-4 h-4 text-white/80" />
                  </a>

                  {/* Item 4: Portal do Cliente */}
                  <a
                    href="https://portaldocliente.3atoimoveis.com.br/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-3.5 rounded-full text-base font-semibold bg-neutral-900 hover:bg-black text-white border border-[#E07A3F] transition-all shadow-md px-5"
                  >
                    <span>Portal do Cliente</span>
                    <ExternalLink className="w-4 h-4 text-[#E07A3F]" />
                  </a>
                </nav>
              </div>

              {/* Mobile Drawer Footer with Contact Info */}
              <div className="p-6 border-t border-neutral-200 bg-neutral-50 text-xs text-neutral-600 space-y-2">
                <p className="font-semibold text-neutral-900">3° ATO IMÓVEIS E NEGÓCIOS</p>
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
