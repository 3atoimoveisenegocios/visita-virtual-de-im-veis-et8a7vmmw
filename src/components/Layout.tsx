import { useState, useEffect } from 'react'
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth'
import { settingsService } from '@/services/settings'
import type { SiteSettings, LogoSize } from '@/types'
import { Compass, Building2, PlusCircle, LogOut, Menu, User, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mobileAdminOpen, setMobileAdminOpen] = useState(false)
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)

  const isTourPage = location.pathname.startsWith('/visita/')
  const isAdminPage = location.pathname.startsWith('/admin') && location.pathname !== '/admin'

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await settingsService.getSettings()
        if (data) {
          setSiteSettings(data)
        }
      } catch (err) {
        console.error('Erro ao carregar configurações do site:', err)
      }
    }

    loadSettings()

    const handleSettingsUpdated = (e: any) => {
      if (e?.detail) {
        setSiteSettings(e.detail)
      } else {
        loadSettings()
      }
    }

    window.addEventListener('settings-updated', handleSettingsUpdated)
    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdated)
    }
  }, [])

  const handleLogout = () => {
    authService.logout()
    navigate('/admin')
  }

  // The 360° tour screen is full screen immersive HUD (handles its own header)
  if (isTourPage) {
    return (
      <main className="w-screen h-screen overflow-hidden bg-black">
        <Outlet />
      </main>
    )
  }

  // Admin Screen with Sidebar
  if (isAdminPage) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex flex-col md:flex-row text-[#1C2B36]">
        {/* Mobile Admin Topbar with Hamburger */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1F4E5F] text-white sticky top-0 z-40 shadow-sm">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            {siteSettings?.logo ? (
              <img
                src={settingsService.getFileUrl(siteSettings, siteSettings.logo)}
                alt="Logo"
                className="h-8 max-h-8 w-auto object-contain brightness-0 invert"
              />
            ) : (
              <>
                <Compass className="w-5 h-5 text-[#E07A3F]" />
                <span>Visita Virtual</span>
              </>
            )}
          </Link>
          <Sheet open={mobileAdminOpen} onOpenChange={setMobileAdminOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-[#1F4E5F] text-white p-0 border-r-0">
              <SheetHeader className="p-5 border-b border-white/10 text-left">
                <SheetTitle className="flex items-center gap-2 text-white">
                  <Compass className="w-6 h-6 text-[#E07A3F]" />
                  <span>Painel Imobiliário</span>
                </SheetTitle>
              </SheetHeader>
              <div className="p-4 flex flex-col gap-2">
                <Link
                  to="/admin/imoveis"
                  onClick={() => setMobileAdminOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <Building2 className="w-4 h-4 text-[#E07A3F]" />
                  <span>Imóveis</span>
                </Link>
                <Link
                  to="/admin/imoveis/novo"
                  onClick={() => setMobileAdminOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <PlusCircle className="w-4 h-4 text-[#E07A3F]" />
                  <span>Novo Imóvel</span>
                </Link>
                <Link
                  to="/admin/aparencia"
                  onClick={() => setMobileAdminOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <Palette className="w-4 h-4 text-[#E07A3F]" />
                  <span>Aparência</span>
                </Link>
                <Link
                  to="/"
                  onClick={() => setMobileAdminOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <Compass className="w-4 h-4" />
                  <span>Ver Portal Público</span>
                </Link>
                <hr className="my-2 border-white/10" />
                <button
                  onClick={() => {
                    setMobileAdminOpen(false)
                    handleLogout()
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300 hover:bg-red-500/20 transition-colors w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-[#1F4E5F] text-white min-h-screen p-5 flex-shrink-0">
          <div className="flex items-center gap-2 font-bold text-xl mb-8 min-h-[40px]">
            {siteSettings?.logo ? (
              <img
                src={settingsService.getFileUrl(siteSettings, siteSettings.logo)}
                alt="Logo"
                className="max-h-10 max-w-[200px] object-contain brightness-0 invert"
              />
            ) : (
              <>
                <Compass className="w-6 h-6 text-[#E07A3F]" />
                <span>Visita Virtual</span>
              </>
            )}
          </div>

          <div className="text-xs uppercase tracking-wider text-white/50 mb-3 px-2 font-semibold">
            Gestão
          </div>
          <nav className="flex flex-col gap-1.5 flex-1">
            <Link
              to="/admin/imoveis"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/admin/imoveis'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4 text-[#E07A3F]" />
              <span>Imóveis</span>
            </Link>

            <Link
              to="/admin/imoveis/novo"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/admin/imoveis/novo'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-[#E07A3F]" />
              <span>Novo Imóvel</span>
            </Link>

            <Link
              to="/admin/aparencia"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/admin/aparencia'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Palette className="w-4 h-4 text-[#E07A3F]" />
              <span>Aparência</span>
            </Link>

            <div className="text-xs uppercase tracking-wider text-white/50 mt-6 mb-2 px-2 font-semibold">
              Atalhos
            </div>

            <Link
              to="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Compass className="w-4 h-4" />
              <span>Portal Público</span>
            </Link>
          </nav>

          <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-white/70">
              <User className="w-3.5 h-3.5" />
              <span className="truncate">3atoimoveis@gmail.com</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-200 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da conta</span>
            </button>
          </div>
        </aside>

        {/* Admin Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    )
  }

  // Public Screens (Index, Property Details, Auth standalone pages)
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5F2] text-[#1C2B36]">
      {/* Public Top Navbar */}
      <header
        className={`sticky top-0 z-40 transition-all duration-200 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-[#E2E6E9]'
            : 'bg-white/80 backdrop-blur-sm border-b border-[#E2E6E9]/60'
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 min-h-16 py-2 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group py-1">
            {siteSettings?.logo ? (
              <img
                src={settingsService.getFileUrl(siteSettings, siteSettings.logo)}
                alt="Logo do Portal"
                className={`object-contain transition-transform group-hover:scale-105 ${settingsService.getLogoSizeClass(
                  siteSettings.logo_size as LogoSize,
                )}`}
              />
            ) : (
              <>
                <div className="w-9 h-9 rounded-lg bg-[#1F4E5F] flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105 flex-shrink-0">
                  <Compass className="w-5 h-5 text-[#E07A3F]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg leading-none tracking-tight text-[#1F4E5F]">
                    Visita Virtual
                  </span>
                  <span className="text-[10px] tracking-wider uppercase text-[#5B6B76] font-medium">
                    Imóveis em 360°
                  </span>
                </div>
              </>
            )}
          </Link>

          {/* O botão 'Painel Admin' foi removido da barra pública a pedido do usuário (acesso apenas direto por /admin) */}
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Public Footer */}
      <footer className="bg-[#1C2B36] text-white/80 py-12 border-t border-[#1C2B36]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Compass className="w-6 h-6 text-[#E07A3F]" />
                <span className="font-bold text-white text-lg">Visita Virtual de Imóveis</span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                A experiência imersiva definitiva de tour virtual 360° para corretores e
                imobiliárias. Navegue por cada ambiente como se estivesse lá.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
                Navegação
              </h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <Link to="/" className="hover:text-white transition-colors">
                    Imóveis Disponíveis
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
                Contato & Atendimento
              </h4>
              <p className="text-sm text-white/60 mb-2">Central de Atendimento Imobiliário</p>
              <p className="text-sm text-white/60">WhatsApp: (11) 99999-8888</p>
              <p className="text-sm text-white/60">Email: contato@visitavirtual.com.br</p>
            </div>
          </div>
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-white/40 gap-3">
            <p>
              © {new Date().getFullYear()} Visita Virtual de Imóveis. Todos os direitos reservados.
            </p>
            <p>Tecnologia 360° Equiretangular Imersiva</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
