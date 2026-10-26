/**
 * Utilitários para resiliência de rede:
 * - Retry automático com backoff exponencial simples (2-3 tentativas)
 * - Cache local em localStorage para guardar a última versão boa de dados
 */

export interface RetryOptions {
  /** Número de tentativas totais (padrão: 3) */
  retries?: number
  /** Tempo de espera inicial em milissegundos (padrão: 600ms) */
  delayMs?: number
  /** Fator multiplicador de backoff (padrão: 1.5) */
  backoffFactor?: number
  /** Callback opcional em caso de erro numa tentativa */
  onRetry?: (attempt: number, error: unknown) => void
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Executa uma função assíncrona com retry automático em caso de falha.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, delayMs = 600, backoffFactor = 1.5, onRetry } = options

  let lastError: unknown
  let currentDelay = delayMs

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        onRetry?.(attempt, err)
        await sleep(currentDelay)
        currentDelay = Math.round(currentDelay * backoffFactor)
      }
    }
  }

  throw lastError
}

const CACHE_PREFIX = 'vv360_cache_'

/**
 * Lê um valor do cache local.
 */
export function getLocalCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Suporte a envelope com timestamp
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return parsed.data as T
    }
    return parsed as T
  } catch (err) {
    console.warn(`[LocalCache] Erro ao ler chave "${key}":`, err)
    return null
  }
}

/**
 * Salva um valor no cache local como última versão boa.
 */
export function setLocalCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    const payload = {
      data,
      savedAt: Date.now(),
    }
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload))
  } catch (err) {
    console.warn(`[LocalCache] Erro ao gravar chave "${key}":`, err)
  }
}

/**
 * Remove uma chave do cache local.
 */
export function removeLocalCache(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CACHE_PREFIX + key)
  } catch (err) {
    console.warn(`[LocalCache] Erro ao remover chave "${key}":`, err)
  }
}
