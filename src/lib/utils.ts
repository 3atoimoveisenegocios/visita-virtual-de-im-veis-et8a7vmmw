/* General utility functions (exposes cn) */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges multiple class names into a single string
 * @param inputs - Array of class names
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Detecta se a aplicação está sendo executada dentro de um iframe.
 * Usa verificação segura com try/catch para evitar exceções de cross-origin em navegadores antigos ou restritivos.
 */
export function isInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top
  } catch {
    // Se o acesso a window.top lançar SecurityError / restrição cross-origin, consideramos que está dentro de iframe
    // (pois um documento de topo acessando window.top nunca lança restrição cross-origin com o próprio topo)
    // No entanto, para segurança e robustez, se window.self !== window.parent for acessível, também indica iframe.
    return true
  }
}

/**
 * Determina se o tour virtual deve operar em modo embed (tela cheia sem cabeçalho/rodapé).
 * Retorna true se:
 * 1. O parâmetro `?embed=1` estiver explícito na URL/search string, OU
 * 2. A aplicação estiver rodando dentro de um iframe.
 *
 * @param search - Opcional: a query string (ex: location.search) ou URLSearchParams
 */
export function isEmbedMode(search?: string | URLSearchParams): boolean {
  if (search) {
    const params = typeof search === 'string' ? new URLSearchParams(search) : search
    if (params.get('embed') === '1') {
      return true
    }
  } else if (typeof window !== 'undefined' && window.location?.search) {
    const params = new URLSearchParams(window.location.search)
    if (params.get('embed') === '1') {
      return true
    }
  }

  return isInIframe()
}
