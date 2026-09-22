import React, { useEffect, useRef, useState, useCallback } from 'react'
import { generateProceduralPanorama } from '@/lib/panorama-assets'
import { RotateCw, Compass, ZoomIn, ZoomOut, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PanoramaDirectionPickerProps {
  imageUrl?: string
  roomName: string
  pointName?: string
  direction: number
  onChangeDirection: (deg: number) => void
  connectionType?: 'step' | 'door'
  targetName?: string
}

export const PanoramaDirectionPicker: React.FC<PanoramaDirectionPickerProps> = ({
  imageUrl,
  roomName,
  pointName,
  direction,
  onChangeDirection,
  connectionType = 'step',
  targetName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null)
  const [loadError, setLoadError] = useState(false)

  // Current viewing yaw (0..360) and pitch (-85..85)
  // Direction directly corresponds to yaw! When user looks at the center crosshair,
  // the compass direction is the center yaw.
  const yawRef = useRef<number>(direction)
  const pitchRef = useRef<number>(0)
  const fovRef = useRef<number>(75)

  // Sync yawRef when direction changes from external (e.g. numeric input or slider)
  useEffect(() => {
    // Only update if discrepancy is noticeable to prevent fighting during drag
    const diff = Math.abs((yawRef.current - direction + 360) % 360)
    if (diff > 1 && diff < 359 && !isDraggingRef.current) {
      yawRef.current = (direction + 360) % 360
    }
  }, [direction])

  // Drag interaction state
  const isDraggingRef = useRef<boolean>(false)
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Load image with fallback to procedural panorama
  useEffect(() => {
    setImageLoaded(false)
    setLoadError(false)

    const finalUrl = imageUrl && imageUrl.trim() !== '' ? imageUrl : null

    if (!finalUrl) {
      // Use procedural equirectangular fallback
      const fallbackDataUrl = generateProceduralPanorama(roomName || 'Ambiente')
      const fallbackImg = new Image()
      fallbackImg.onload = () => {
        setImgElement(fallbackImg)
        setImageLoaded(true)
      }
      fallbackImg.src = fallbackDataUrl
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      setImgElement(img)
      setImageLoaded(true)
      setLoadError(false)
    }

    img.onerror = () => {
      setLoadError(true)
      const fallbackDataUrl = generateProceduralPanorama(roomName || 'Ambiente')
      const fallbackImg = new Image()
      fallbackImg.onload = () => {
        setImgElement(fallbackImg)
        setImageLoaded(true)
      }
      fallbackImg.src = fallbackDataUrl
    }

    img.src = finalUrl

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [imageUrl, roomName])

  // Render loop using identical projection technique to PanoramaViewer
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !imgElement || !imageLoaded) return

    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imgW = imgElement.naturalWidth || 2048
    const imgH = imgElement.naturalHeight || 1024

    const fov = fovRef.current
    const yaw = yawRef.current
    const pitch = pitchRef.current

    const spanX = (fov / 360) * imgW * 1.35
    const spanY = spanX * (height / width)

    const centerX = (yaw / 360) * imgW
    const centerY = (0.5 - pitch / 180) * imgH

    const srcX = centerX - spanX / 2
    const srcY = Math.max(0, Math.min(imgH - spanY, centerY - spanY / 2))

    ctx.clearRect(0, 0, width, height)

    // Seamless equirectangular horizontal wrapping
    if (srcX < 0) {
      const part1W = -srcX
      const drawPart1W = (part1W / spanX) * width
      ctx.drawImage(imgElement, imgW + srcX, srcY, part1W, spanY, 0, 0, drawPart1W, height)
      ctx.drawImage(
        imgElement,
        0,
        srcY,
        spanX - part1W,
        spanY,
        drawPart1W,
        0,
        width - drawPart1W,
        height,
      )
    } else if (srcX + spanX > imgW) {
      const part1W = imgW - srcX
      const drawPart1W = (part1W / spanX) * width
      ctx.drawImage(imgElement, srcX, srcY, part1W, spanY, 0, 0, drawPart1W, height)
      ctx.drawImage(
        imgElement,
        0,
        srcY,
        spanX - part1W,
        spanY,
        drawPart1W,
        0,
        width - drawPart1W,
        height,
      )
    } else {
      ctx.drawImage(imgElement, srcX, srcY, spanX, spanY, 0, 0, width, height)
    }
  }, [imgElement, imageLoaded])

  useEffect(() => {
    let animId: number
    const loop = () => {
      render()
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [render])

  // Drag handlers with pointer events (mouse + touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore clicks on control overlay buttons
    if ((e.target as HTMLElement).closest('.no-pan')) return
    isDraggingRef.current = true
    lastMousePosRef.current = { x: e.clientX, y: e.clientY }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return

    const dx = e.clientX - lastMousePosRef.current.x
    const dy = e.clientY - lastMousePosRef.current.y

    const sensitivity = (fovRef.current / 80) * 0.28
    const deltaYaw = dx * sensitivity
    const deltaPitch = dy * sensitivity * 0.55

    // Invert horizontal drag so dragging left looks right (standard camera pan)
    const newYaw = (yawRef.current - deltaYaw + 360) % 360
    yawRef.current = newYaw
    pitchRef.current = Math.max(-80, Math.min(80, pitchRef.current + deltaPitch))

    lastMousePosRef.current = { x: e.clientX, y: e.clientY }

    const roundedDeg = Math.round(newYaw) % 360
    onChangeDirection(roundedDeg)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const roundedDeg = Math.round(yawRef.current) % 360
      onChangeDirection(roundedDeg)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomDelta = e.deltaY > 0 ? 4 : -4
    fovRef.current = Math.max(45, Math.min(95, fovRef.current + zoomDelta))
  }

  const rotateBy = (degDelta: number) => {
    const nextYaw = (yawRef.current + degDelta + 360) % 360
    yawRef.current = nextYaw
    onChangeDirection(Math.round(nextYaw) % 360)
  }

  const zoomBy = (fovDelta: number) => {
    fovRef.current = Math.max(45, Math.min(95, fovRef.current + fovDelta))
  }

  const getCardinalName = (deg: number) => {
    const d = (deg + 360) % 360
    if (d >= 337.5 || d < 22.5) return 'Norte (Frente)'
    if (d >= 22.5 && d < 67.5) return 'Nordeste'
    if (d >= 67.5 && d < 112.5) return 'Leste (Direita)'
    if (d >= 112.5 && d < 157.5) return 'Sudeste'
    if (d >= 157.5 && d < 202.5) return 'Sul (Costas)'
    if (d >= 202.5 && d < 247.5) return 'Sudoeste'
    if (d >= 247.5 && d < 292.5) return 'Oeste (Esquerda)'
    return 'Noroeste'
  }

  const isStep = connectionType === 'step'

  return (
    <div className="space-y-2">
      {/* Viewer Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="relative w-full h-[280px] sm:h-[300px] rounded-2xl overflow-hidden bg-black select-none cursor-grab active:cursor-grabbing border-2 border-[#1F4E5F]/30 shadow-inner group"
        style={{ touchAction: 'none' }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Loading overlay */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white z-20">
            <div className="w-8 h-8 border-3 border-white/20 border-t-[#E07A3F] rounded-full animate-spin mb-2" />
            <p className="text-xs font-semibold">Carregando panorama de origem...</p>
          </div>
        )}

        {/* Notice badge if fallback was used */}
        {loadError && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-amber-500/90 text-white text-[10px] font-medium px-2.5 py-1 rounded-full shadow-md backdrop-blur-xs">
            <Info className="w-3 h-3 flex-shrink-0" />
            <span>Usando simulação 360° (imagem não encontrada)</span>
          </div>
        )}

        {/* Top Floating Badge: Room Origin info */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/70 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full border border-white/15 pointer-events-none">
          <Compass className="w-3.5 h-3.5 text-[#E07A3F]" />
          <span className="font-semibold">{roomName}</span>
          {pointName && <span className="text-white/60">• {pointName}</span>}
        </div>

        {/* Top Right: Degree readout pill */}
        <div className="absolute top-3 right-3 z-10 bg-black/75 backdrop-blur-md text-white text-xs font-mono font-bold px-3 py-1.5 rounded-full border border-white/20 shadow pointer-events-none flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#E07A3F] animate-pulse" />
          <span>{Math.round(direction)}°</span>
          <span className="text-[10px] font-normal text-white/70">
            ({getCardinalName(direction).split(' ')[0]})
          </span>
        </div>

        {/* CENTER CROSSHAIR / ARROW TARGET (The visual reference) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
          {/* Subtle horizontal alignment line across viewer */}
          <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent" />

          {/* Target Reticle & Indicator */}
          <div className="relative flex flex-col items-center justify-center -translate-y-2">
            {/* Compass directional heading pointer above */}
            <div className="mb-2 px-2.5 py-0.5 rounded-full bg-black/85 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold shadow-lg flex items-center gap-1 animate-bounce">
              <span>{Math.round(direction)}°</span>
              <span className="text-[#E07A3F]">▼</span>
            </div>

            {/* Target indicator icon matching tour look */}
            {isStep ? (
              /* Street View step disc */
              <div className="relative flex flex-col items-center">
                <div className="relative w-16 h-12 flex items-center justify-center">
                  <div className="absolute w-16 h-8 rounded-[100%] bg-[#E07A3F]/35 border-2 border-white shadow-[0_0_15px_rgba(224,122,63,0.8)] animate-pulse" />
                  <div className="relative z-10 w-10 h-10 rounded-full bg-[#E07A3F] text-white flex items-center justify-center shadow-2xl border-2 border-white">
                    <svg
                      className="w-5 h-5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </div>
                </div>
                <div className="mt-1 bg-black/85 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/25 shadow-lg whitespace-nowrap">
                  {targetName || 'Próximo passo aqui'}
                </div>
              </div>
            ) : (
              /* Door / Exit circular hotspot */
              <div className="relative flex flex-col items-center">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-14 h-14 rounded-full bg-[#1F4E5F]/40 animate-ping" />
                  <div className="w-11 h-11 rounded-full bg-[#1F4E5F] border-2 border-white text-white flex items-center justify-center shadow-2xl">
                    <svg
                      className="w-5 h-5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <div className="mt-1 bg-black/85 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/25 shadow-lg whitespace-nowrap">
                  {targetName || 'Saída / Porta aqui'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom instructions bar */}
        <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
          <div className="bg-black/75 backdrop-blur-md text-white text-[11px] px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 shadow">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Arraste o panorama até a mira apontar para o destino</span>
          </div>

          {/* Quick viewer controls on the bottom-right */}
          <div className="flex items-center gap-1 pointer-events-auto no-pan">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => rotateBy(-45)}
              className="h-7 w-7 p-0 bg-black/70 hover:bg-black/90 text-white rounded-lg border border-white/15"
              title="Girar 45° para esquerda"
            >
              <RotateCw className="w-3.5 h-3.5 -scale-x-100" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => rotateBy(45)}
              className="h-7 w-7 p-0 bg-black/70 hover:bg-black/90 text-white rounded-lg border border-white/15"
              title="Girar 45° para direita"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => zoomBy(-10)}
              className="h-7 w-7 p-0 bg-black/70 hover:bg-black/90 text-white rounded-lg border border-white/15 hidden sm:inline-flex"
              title="Aproximar zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => zoomBy(10)}
              className="h-7 w-7 p-0 bg-black/70 hover:bg-black/90 text-white rounded-lg border border-white/15 hidden sm:inline-flex"
              title="Afastar zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
