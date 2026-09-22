/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Index from './pages/Index'
import PropertyDetails from './pages/PropertyDetails'
import VirtualTour from './pages/VirtualTour'
import AdminLogin from './pages/admin/AdminLogin'
import AdminPropertiesList from './pages/admin/AdminPropertiesList'
import AdminPropertyForm from './pages/admin/AdminPropertyForm'
import AdminTourBuilder from './pages/admin/AdminTourBuilder'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import VerifyEmail from './pages/auth/VerifyEmail'
import ConfirmEmailChange from './pages/auth/ConfirmEmailChange'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

const App = () => (
  <BrowserRouter>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <Routes>
        <Route element={<Layout />}>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/imovel/:id" element={<PropertyDetails />} />
          <Route path="/visita/:id" element={<VirtualTour />} />

          {/* Admin auth & management routes */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/imoveis" element={<AdminPropertiesList />} />
          <Route path="/admin/imoveis/novo" element={<AdminPropertyForm />} />
          <Route path="/admin/imoveis/:id/editar" element={<AdminPropertyForm />} />
          <Route path="/admin/imoveis/:id/tour" element={<AdminTourBuilder />} />

          {/* User auth flow pages */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
