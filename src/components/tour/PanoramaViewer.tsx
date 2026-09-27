import React, { useEffect, useRef, useState, useCallback } from 'react'
import { generateProceduralPanorama } from '@/lib/panorama-assets'
import type { Hotspot } from '@/types'
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface PanoramaViewerProps {
  imageUrl: string
  roomName: string
  pointName?: string
  hotspots: Hotspot[]
  onHotspotClick: (hotspot: Hotspot) => void
  isLoading?: boolean
}

export const PanoramaViewer: React.FC<PanoramaViewerProps> = ({
  imageUrl,
  roomName,
  pointName,
  hotspots,
  onHotspotClick,
  isLoading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null)

  // View state (spherical angles in degrees)
  // FOV limits: 45° (max zoom-in) up to 135° (wide zoom-out). Default open FOV: 95°.
  const DEFAULT_FOV = 95
  const MIN_FOV = 45
  const MAX_FOV = 135

  const yawRef = useRef<number>(0) // 0..360 horizontal
  const pitchRef = useRef<number>(0) // -85..85 vertical
  const fovRef = useRef<number>(DEFAULT_FOV) // Field of view (higher = zoomed out / wider angle)

  // Drag interaction and touch pinch state
  const isDraggingRef = useRef<boolean>(false)
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 })
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const initialPinchDistRef = useRef<number | null>(null)
  const initialPinchFovRef = useRef<number>(DEFAULT_FOV)
  const [visibleHotspots, setVisibleHotspots] = useState<
    Array<{
      hotspot: Hotspot
      x: number
      y: number
      visible: boolean
    }>
  >([])

  // On image/point change: keep an open wide-angle FOV so transitions don't abruptly zoom in
  useEffect(() => {
    // If the user was zoomed into a detail (< DEFAULT_FOV), reset to the open DEFAULT_FOV
    // so moving into a new room or point provides a full panoramic overview
    if (fovRef.current < DEFAULT_FOV) {
      fovRef.current = DEFAULT_FOV
    }
  }, [imageUrl])

  // Load image with fallback
  useEffect(() => {
    setImageLoaded(false)
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      setImgElement(img)
      setImageLoaded(true)
    }

    img.onerror = () => {
      // Fallback: build procedural equirectangular panorama canvas
      const fallbackDataUrl = generateProceduralPanorama(roomName)
      const fallbackImg = new Image()
      fallbackImg.onload = () => {
        setImgElement(fallbackImg)
        setImageLoaded(true)
      }
      fallbackImg.src = fallbackDataUrl
    }

    img.src = imageUrl

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [imageUrl, roomName])

  // Main WebGL / Canvas 2D Equirectangular projection renderer
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !imgElement || !imageLoaded) return

    const width = container.clientWidth
    const height = container.clientHeight

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Apply inertia damping
    if (!isDraggingRef.current) {
      yawRef.current = (yawRef.current - velocityRef.current.vx + 360) % 360
      pitchRef.current = Math.max(-85, Math.min(85, pitchRef.current + velocityRef.current.vy))
      velocityRef.current.vx *= 0.92
      velocityRef.current.vy *= 0.92
      if (Math.abs(velocityRef.current.vx) < 0.001) velocityRef.current.vx = 0
      if (Math.abs(velocityRef.current.vy) < 0.001) velocityRef.current.vy = 0
    }

    // Equirectangular slice rendering for ultra smooth 60fps pan/zoom
    const imgW = imgElement.naturalWidth || 2048
    const imgH = imgElement.naturalHeight || 1024

    const fov = fovRef.current
    const yaw = yawRef.current
    const pitch = pitchRef.current

    // Map yaw & pitch to image coordinates
    // yaw: 0-360 mapped to imgW
    // fov determines horizontal span
    const spanX = (fov / 360) * imgW * 1.35
    const spanY = spanX * (height / width)

    const centerX = (yaw / 360) * imgW
    const centerY = (0.5 - pitch / 180) * imgH

    const srcX = centerX - spanX / 2
    const srcY = Math.max(0, Math.min(imgH - spanY, centerY - spanY / 2))

    ctx.clearRect(0, 0, width, height)

    // Handle horizontal wrap-around seamlessly
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

    // Calculate screen positions of hotspots based on current yaw/pitch/fov
    const newHotspotPositions = hotspots.map((hs) => {
      // hs.direction is 0..360 (compass direction)
      let diff = hs.direction - yaw
      // normalize to -180..180
      while (diff < -180) diff += 360
      while (diff > 180) diff -= 360

      const halfFov = (fov / 2) * 1.35
      const isVisible = Math.abs(diff) <= halfFov

      // Project onto canvas width
      const screenX = (0.5 + diff / (halfFov * 2)) * width
      // Slight vertical placement depending on pitch (ground/door level ~ 60% down)
      const baseVertical = 0.58
      const pitchOffset = (pitch / 90) * 0.45
      const screenY = (baseVertical + pitchOffset) * height

      return {
        hotspot: hs,
        x: screenX,
        y: Math.max(80, Math.min(height - 100, screenY)),
        visible: isVisible,
      }
    })

    setVisibleHotspots(newHotspotPositions)
  }, [imgElement, imageLoaded, hotspots])

  // Animation frame loop
  useEffect(() => {
    let animId: number
    const loop = () => {
      render()
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [render])

  // Pointer event handlers (Mouse, Touch, and Pinch-to-zoom)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest('.interactive-hotspot') ||
      (e.target as HTMLElement).closest('.no-pan')
    )
      return
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointersRef.current.size === 1) {
      isDraggingRef.current = true
      lastMousePosRef.current = { x: e.clientX, y: e.clientY }
      velocityRef.current = { vx: 0, vy: 0 }
    } else if (activePointersRef.current.size === 2) {
      // Pinch gesture start
      isDraggingRef.current = false
      const pts = Array.from(activePointersRef.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      initialPinchDistRef.current = dist
      initialPinchFovRef.current = fovRef.current
    }

    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Pinch-to-zoom with 2 fingers
    if (activePointersRef.current.size === 2 && initialPinchDistRef.current !== null) {
      const pts = Array.from(activePointersRef.current.values())
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      if (initialPinchDistRef.current > 0) {
        const scale = currentDist / initialPinchDistRef.current
        // Spreading fingers (scale > 1) = zoom in (smaller FOV)
        // Pinching fingers (scale < 1) = zoom out (larger FOV)
        const newFov = initialPinchFovRef.current / scale
        fovRef.current = Math.max(MIN_FOV, Math.min(MAX_FOV, newFov))
      }
      return
    }

    if (!isDraggingRef.current) return

    const dx = e.clientX - lastMousePosRef.current.x
    const dy = e.clientY - lastMousePosRef.current.y

    const sensitivity = (fovRef.current / 95) * 0.28
    const deltaYaw = dx * sensitivity
    const deltaPitch = dy * sensitivity * 0.7

    yawRef.current = (yawRef.current - deltaYaw + 360) % 360
    pitchRef.current = Math.max(-85, Math.min(85, pitchRef.current + deltaPitch))

    velocityRef.current = { vx: deltaYaw * 0.4, vy: deltaPitch * 0.4 }
    lastMousePosRef.current = { x: e.clientX, y: e.clientY }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId)
    if (activePointersRef.current.size < 2) {
      initialPinchDistRef.current = null
    }

    if (activePointersRef.current.size === 1) {
      // Switch back to single finger drag
      const remainingPt = Array.from(activePointersRef.current.values())[0]
      lastMousePosRef.current = { x: remainingPt.x, y: remainingPt.y }
      isDraggingRef.current = true
    } else {
      isDraggingRef.current = false
    }

    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* intentionally ignored */
    }
  }

  // Mouse wheel zoom: deltaY > 0 is scroll down (zoom out = increase FOV), deltaY < 0 is scroll up (zoom in = decrease FOV)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomDelta = e.deltaY > 0 ? 5 : -5
    fovRef.current = Math.max(MIN_FOV, Math.min(MAX_FOV, fovRef.current + zoomDelta))
  }

  // Zoom control buttons
  const zoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    fovRef.current = Math.max(MIN_FOV, Math.min(MAX_FOV, fovRef.current - 12))
  }

  const zoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    fovRef.current = Math.max(MIN_FOV, Math.min(MAX_FOV, fovRef.current + 12))
  }

  const resetView = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    fovRef.current = DEFAULT_FOV
    pitchRef.current = 0
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-black"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating On-Screen Zoom & Reset Controls */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 no-pan pointer-events-auto">
        <button
          type="button"
          onClick={zoomIn}
          className="w-10 h-10 rounded-full bg-[rgba(15,23,32,0.78)] hover:bg-[rgba(15,23,32,0.95)] active:scale-95 text-white backdrop-blur-md border border-white/15 flex items-center justify-center shadow-lg transition-transform"
          title="Aproximar zoom (+)"
          aria-label="Aproximar zoom"
        >
          <ZoomIn className="w-4 h-4 text-white" />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          className="w-10 h-10 rounded-full bg-[rgba(15,23,32,0.78)] hover:bg-[rgba(15,23,32,0.95)] active:scale-95 text-white backdrop-blur-md border border-white/15 flex items-center justify-center shadow-lg transition-transform"
          title="Afastar zoom / Visão ampla (-)"
          aria-label="Afastar zoom"
        >
          <ZoomOut className="w-4 h-4 text-white" />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="w-10 h-10 rounded-full bg-[rgba(15,23,32,0.78)] hover:bg-[rgba(15,23,32,0.95)] active:scale-95 text-white backdrop-blur-md border border-white/15 flex items-center justify-center shadow-lg transition-transform"
          title="Redefinir visão panorâmica"
          aria-label="Redefinir visão panorâmica"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#E07A3F]" />
        </button>
      </div>

      {/* Loading overlay */}
      {(isLoading || !imageLoaded) && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
          <div className="w-12 h-12 border-4 border-white/20 border-t-[#E07A3F] rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium tracking-wide">Carregando visualização 360°...</p>
          <span className="text-xs text-white/60 mt-1">
            {roomName} {pointName ? `• ${pointName}` : ''}
          </span>
        </div>
      )}

      {/* Interactive Navigation Hotspots rendered on top */}
      {imageLoaded &&
        visibleHotspots
          .filter((item) => item.visible)
          .map((item) => {
            const isStep =
              item.hotspot.type === 'step' ||
              (item.hotspot.room === item.hotspot.target_room && !!item.hotspot.target_nav_point)
            const targetPointName = item.hotspot.expand?.target_nav_point?.name
            const targetRoomName = item.hotspot.expand?.target_room?.name
            const label =
              item.hotspot.label ||
              (isStep
                ? targetPointName || 'Caminhar para cá'
                : `Ir para ${targetRoomName || 'Próximo ambiente'}`)

            return (
              <div
                key={item.hotspot.id}
                className="interactive-hotspot absolute z-10 -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-transform duration-200 hover:scale-110"
                style={{
                  left: `${item.x}px`,
                  top: `${item.y}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onHotspotClick(item.hotspot)
                }}
              >
                {isStep ? (
                  /* Street View style displacement arrow / disc indicator */
                  <div className="relative flex flex-col items-center justify-center">
                    {/* Perspective floor disc */}
                    <div className="relative w-16 h-12 flex items-center justify-center">
                      <div className="absolute w-16 h-8 rounded-[100%] bg-white/25 border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.6)] animate-pulse pointer-events-none transition-transform group-hover:scale-110 group-hover:bg-[#E07A3F]/40 group-hover:border-[#E07A3F]" />
                      <div className="relative z-10 w-9 h-9 rounded-full bg-[#E07A3F] text-white flex items-center justify-center shadow-xl border-2 border-white group-hover:scale-110 transition-transform">
                        {/* Up arrow / chevron forward indicator */}
                        <svg
                          className="w-5 h-5 text-white transition-transform group-hover:-translate-y-0.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                      </div>
                    </div>

                    {/* Step Tooltip */}
                    <div className="mt-1 whitespace-nowrap bg-black/85 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg border border-white/20 pointer-events-none transition-all group-hover:bg-[#E07A3F] group-hover:border-white">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                        {label}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Door / Room exit circular hotspot */
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-12 h-12 rounded-full bg-[#E07A3F]/30 animate-pulse-ring pointer-events-none" />

                    <div className="w-10 h-10 rounded-full bg-[#1F4E5F] border-2 border-white text-white flex items-center justify-center shadow-lg transition-colors group-hover:bg-[#E07A3F]">
                      <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
                    </div>

                    <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/85 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md border border-white/20 pointer-events-none transition-opacity duration-200">
                      {label}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
    </div>
  )
}
