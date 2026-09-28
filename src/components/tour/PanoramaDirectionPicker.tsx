import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { generateProceduralPanorama } from '@/lib/panorama-assets'
import {
  DEFAULT_PANORAMA_FOV,
  MIN_PANORAMA_FOV,
  MAX_PANORAMA_FOV,
  MIN_PITCH_DEG,
  MAX_PITCH_DEG,
  isWebGLAvailable,
  sphericalToVector3,
} from '@/lib/panorama-spherical'
import { RotateCw, Compass, ZoomIn, ZoomOut, Info, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ArrowSize, ArrowOrientation } from '@/types'
import { getArrowSizeStyles, getArrowRotationDegrees } from '@/components/tour/PanoramaViewer'

interface PanoramaDirectionPickerProps {
  imageUrl?: string
  roomName: string
  pointName?: string
  direction: number
  pitch?: number
  onChangeDirection: (deg: number) => void
  onChangePitch?: (deg: number) => void
  connectionType?: 'step' | 'door'
  targetName?: string
  mode?: 'connection' | 'initial_view'
  arrowSize?: ArrowSize
  arrowOrientation?: ArrowOrientation
  arrowRotation?: number
}

export const PanoramaDirectionPicker: React.FC<PanoramaDirectionPickerProps> = ({
  imageUrl,
  roomName,
  pointName,
  direction,
  pitch = 0,
  onChangeDirection,
  onChangePitch,
  connectionType = 'step',
  targetName,
  mode = 'connection',
  arrowSize = 'pequeno',
  arrowOrientation = 'reta',
  arrowRotation = 0,
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [webglSupported, setWebglSupported] = useState(true)

  // Current viewing yaw (0..360) and pitch (-89.5..89.5) - full vertical pan
  // Direction directly corresponds to yaw! When user looks at the center crosshair,
  // the compass direction is the center yaw.
  const yawRef = useRef<number>((direction + 360) % 360)
  const pitchRef = useRef<number>(Math.max(MIN_PITCH_DEG, Math.min(MAX_PITCH_DEG, pitch)))
  const fovRef = useRef<number>(DEFAULT_PANORAMA_FOV)

  // Sync yawRef & pitchRef when direction/pitch changes from external (e.g. numeric input or slider)
  useEffect(() => {
    const diff = Math.abs((yawRef.current - direction + 360) % 360)
    if (diff > 1 && diff < 359 && !isDraggingRef.current) {
      yawRef.current = (direction + 360) % 360
    }
    if (!isDraggingRef.current && Math.abs(pitchRef.current - pitch) > 0.5) {
      pitchRef.current = Math.max(MIN_PITCH_DEG, Math.min(MAX_PITCH_DEG, pitch))
    }
  }, [direction, pitch])

  // Drag interaction state and touch pinch
  const isDraggingRef = useRef<boolean>(false)
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const initialPinchDistRef = useRef<number | null>(null)
  const initialPinchFovRef = useRef<number>(DEFAULT_PANORAMA_FOV)
  const isPinchingRef = useRef<boolean>(false)

  // Three.js instances ref
  const threeRefs = useRef<{
    renderer: THREE.WebGLRenderer | null
    scene: THREE.Scene | null
    camera: THREE.PerspectiveCamera | null
    mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null
    texture: THREE.Texture | null
    animId: number | null
  }>({
    renderer: null,
    scene: null,
    camera: null,
    mesh: null,
    texture: null,
    animId: null,
  })

  // Check WebGL availability
  useEffect(() => {
    setWebglSupported(isWebGLAvailable())
  }, [])

  // Initialize Three.js scene for spherical 360° rendering
  useEffect(() => {
    const container = mountRef.current
    if (!container || !webglSupported) return

    const width = container.clientWidth || 400
    const height = container.clientHeight || 300

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(fovRef.current, width / height, 0.1, 1500)
    camera.position.set(0, 0, 0)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      })
    } catch {
      setWebglSupported(false)
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)

    // Sphere geometry with inward faces
    const geometry = new THREE.SphereGeometry(500, 64, 32)
    geometry.scale(-1, 1, 1)

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.FrontSide,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    threeRefs.current.renderer = renderer
    threeRefs.current.scene = scene
    threeRefs.current.camera = camera
    threeRefs.current.mesh = mesh

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        const h = entry.contentRect.height
        if (w > 0 && h > 0) {
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          renderer.setSize(w, h, false)
        }
      }
    })
    resizeObserver.observe(container)

    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)

      if (Math.abs(camera.fov - fovRef.current) > 0.01) {
        camera.fov = fovRef.current
        camera.updateProjectionMatrix()
      }

      const lookTarget = sphericalToVector3(yawRef.current, pitchRef.current, 500)
      camera.lookAt(lookTarget)

      renderer.render(scene, camera)
    }

    animate()
    threeRefs.current.animId = animId

    return () => {
      cancelAnimationFrame(animId)
      resizeObserver.disconnect()

      if (threeRefs.current.texture) {
        threeRefs.current.texture.dispose()
        threeRefs.current.texture = null
      }
      geometry.dispose()
      material.dispose()
      renderer.dispose()

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      threeRefs.current.renderer = null
      threeRefs.current.scene = null
      threeRefs.current.camera = null
      threeRefs.current.mesh = null
    }
  }, [webglSupported])

  // Load equirectangular texture (with procedural fallback)
  useEffect(() => {
    setImageLoaded(false)
    setLoadError(false)

    let isCancelled = false
    const textureLoader = new THREE.TextureLoader()

    const applyTexture = (texture: THREE.Texture) => {
      if (isCancelled) {
        texture.dispose()
        return
      }

      // Standard UV mapping onto the inside of the SphereGeometry.
      // Do NOT set texture.mapping = THREE.EquirectangularReflectionMapping,
      // because ReflectionMapping recomputes texture coordinates based on camera view
      // direction / reflection vectors, which causes severe distortion and zooming
      // when rotating left or right!
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = true

      const mesh = threeRefs.current.mesh
      if (mesh) {
        if (threeRefs.current.texture) {
          threeRefs.current.texture.dispose()
        }
        threeRefs.current.texture = texture
        mesh.material.map = texture
        mesh.material.needsUpdate = true
      }
      setImageLoaded(true)
    }

    const loadFallbackProcedural = () => {
      const fallbackUrl = generateProceduralPanorama(roomName || 'Ambiente')
      textureLoader.load(
        fallbackUrl,
        (fallbackTex) => {
          applyTexture(fallbackTex)
        },
        undefined,
        () => {
          if (!isCancelled) setImageLoaded(true)
        },
      )
    }

    const finalUrl = imageUrl && imageUrl.trim() !== '' ? imageUrl : null
    if (!finalUrl) {
      loadFallbackProcedural()
      return
    }

    textureLoader.load(
      finalUrl,
      (loadedTex) => {
        applyTexture(loadedTex)
        setLoadError(false)
      },
      undefined,
      () => {
        if (isCancelled) return
        setLoadError(true)
        loadFallbackProcedural()
      },
    )

    return () => {
      isCancelled = true
    }
  }, [imageUrl, roomName])

  // Pointer event handlers (drag, pan, pinch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.no-pan')) return
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointersRef.current.size === 1) {
      isDraggingRef.current = true
      isPinchingRef.current = false
      initialPinchDistRef.current = null
      lastMousePosRef.current = { x: e.clientX, y: e.clientY }
    } else if (activePointersRef.current.size === 2) {
      isDraggingRef.current = false
      const pts = Array.from(activePointersRef.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      initialPinchDistRef.current = dist
      initialPinchFovRef.current = fovRef.current
      isPinchingRef.current = false
    } else {
      isDraggingRef.current = false
      isPinchingRef.current = false
      initialPinchDistRef.current = null
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

    // Pinch-to-zoom with exactly 2 fingers
    if (activePointersRef.current.size === 2 && initialPinchDistRef.current !== null) {
      const pts = Array.from(activePointersRef.current.values())
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const distDiff = Math.abs(currentDist - initialPinchDistRef.current)

      // Require a threshold of 12px change in distance to confirm intentional pinch
      if (!isPinchingRef.current) {
        if (distDiff >= 12) {
          isPinchingRef.current = true
          initialPinchDistRef.current = currentDist
          initialPinchFovRef.current = fovRef.current
        }
      }

      if (isPinchingRef.current && initialPinchDistRef.current > 0) {
        const scale = currentDist / initialPinchDistRef.current
        const newFov = initialPinchFovRef.current / scale
        fovRef.current = Math.max(MIN_PANORAMA_FOV, Math.min(MAX_PANORAMA_FOV, newFov))
      }
      return
    }

    // While dragging with 1 pointer, FOV is strictly locked and cannot change
    if (!isDraggingRef.current || activePointersRef.current.size !== 1) return

    const dx = e.clientX - lastMousePosRef.current.x
    const dy = e.clientY - lastMousePosRef.current.y

    const sensitivity = (fovRef.current / DEFAULT_PANORAMA_FOV) * 0.22
    const deltaYaw = dx * sensitivity
    const deltaPitch = dy * sensitivity * 0.55

    // Invert horizontal drag so dragging left looks right (standard camera pan)
    const newYaw = (yawRef.current - deltaYaw + 360) % 360
    const newPitch = Math.max(MIN_PITCH_DEG, Math.min(MAX_PITCH_DEG, pitchRef.current + deltaPitch))

    yawRef.current = newYaw
    pitchRef.current = newPitch

    lastMousePosRef.current = { x: e.clientX, y: e.clientY }

    const roundedDeg = Math.round(newYaw) % 360
    onChangeDirection(roundedDeg)
    if (onChangePitch) {
      onChangePitch(Math.round(newPitch))
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId)
    if (activePointersRef.current.size < 2) {
      initialPinchDistRef.current = null
      isPinchingRef.current = false
    }

    if (activePointersRef.current.size === 1) {
      const remainingPt = Array.from(activePointersRef.current.values())[0]
      lastMousePosRef.current = { x: remainingPt.x, y: remainingPt.y }
      isDraggingRef.current = true
    } else {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        const roundedDeg = Math.round(yawRef.current) % 360
        onChangeDirection(roundedDeg)
        if (onChangePitch) {
          onChangePitch(Math.round(pitchRef.current))
        }
      }
    }

    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  // Wheel handling: Google Street View behavior.
  // Standard two-finger touchpad scroll or mouse scroll WITHOUT Ctrl rotates camera (yaw/pitch).
  // Zoom via wheel only occurs when Ctrl or Meta (Cmd) is pressed.
  // When active pointer drag is happening, wheel cannot alter FOV.
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()

    const isZoomKey = e.ctrlKey || e.metaKey

    if (isZoomKey) {
      if (isDraggingRef.current || activePointersRef.current.size > 0) return

      const zoomDelta = e.deltaY > 0 ? 5 : -5
      fovRef.current = Math.max(
        MIN_PANORAMA_FOV,
        Math.min(MAX_PANORAMA_FOV, fovRef.current + zoomDelta),
      )
      return
    }

    // Street view rotation via wheel/trackpad
    const factor = (fovRef.current / DEFAULT_PANORAMA_FOV) * 0.12
    const deltaYaw = e.deltaX * factor
    const deltaPitch = -e.deltaY * factor * 0.55

    const nextYaw = (yawRef.current - deltaYaw + 360) % 360
    const nextPitch = Math.max(
      MIN_PITCH_DEG,
      Math.min(MAX_PITCH_DEG, pitchRef.current + deltaPitch),
    )

    yawRef.current = nextYaw
    pitchRef.current = nextPitch

    const roundedDeg = Math.round(nextYaw) % 360
    onChangeDirection(roundedDeg)
    if (onChangePitch) {
      onChangePitch(Math.round(nextPitch))
    }
  }

  const rotateBy = (degDelta: number) => {
    const nextYaw = (yawRef.current + degDelta + 360) % 360
    yawRef.current = nextYaw
    onChangeDirection(Math.round(nextYaw) % 360)
  }

  const resetInitialView = () => {
    yawRef.current = 0
    pitchRef.current = 0
    onChangeDirection(0)
    if (onChangePitch) onChangePitch(0)
  }

  const zoomBy = (fovDelta: number) => {
    fovRef.current = Math.max(
      MIN_PANORAMA_FOV,
      Math.min(MAX_PANORAMA_FOV, fovRef.current + fovDelta),
    )
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
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="relative w-full h-[280px] sm:h-[300px] rounded-2xl overflow-hidden bg-black select-none cursor-grab active:cursor-grabbing border-2 border-[#1F4E5F]/30 shadow-inner group"
        style={{ touchAction: 'none' }}
      >
        {/* Loading overlay */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white z-20 pointer-events-none">
            <div className="w-8 h-8 border-3 border-white/20 border-t-[#E07A3F] rounded-full animate-spin mb-2" />
            <p className="text-xs font-semibold">Carregando panorama de origem em 360°...</p>
          </div>
        )}

        {/* Notice badge if fallback was used */}
        {loadError && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-amber-500/90 text-white text-[10px] font-medium px-2.5 py-1 rounded-full shadow-md backdrop-blur-xs pointer-events-none">
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

        {/* Top Right: Degree & Pitch readout pill */}
        <div className="absolute top-3 right-3 z-10 bg-black/75 backdrop-blur-md text-white text-xs font-mono font-bold px-3 py-1.5 rounded-full border border-white/20 shadow pointer-events-none flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#E07A3F] animate-pulse" />
          <span>Yaw: {Math.round(direction)}°</span>
          {onChangePitch && <span className="text-white/70">• Pitch: {Math.round(pitch)}°</span>}
          <span className="text-[10px] font-normal text-white/70">
            ({getCardinalName(direction).split(' ')[0]})
          </span>
        </div>

        {/* CENTER CROSSHAIR / ARROW TARGET (The visual reference) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
          {/* Subtle horizontal alignment line across viewer */}
          <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-white/25 to-transparent" />

          {/* Target Reticle & Indicator */}
          <div className="relative flex flex-col items-center justify-center -translate-y-2">
            {/* Compass directional heading pointer above */}
            <div className="mb-2 px-2.5 py-0.5 rounded-full bg-black/85 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold shadow-lg flex items-center gap-1 animate-bounce">
              <span>{Math.round(direction)}°</span>
              <span className="text-[#E07A3F]">▼</span>
            </div>

            {mode === 'initial_view' ? (
              /* Initial Frontal View Reticle (Insta360 camera look) */
              <div className="relative flex flex-col items-center">
                <div className="relative w-14 h-14 flex items-center justify-center">
                  <div className="absolute w-14 h-14 rounded-full border-2 border-dashed border-[#E07A3F] animate-spin" />
                  <div className="w-10 h-10 rounded-full bg-[#1F4E5F]/90 border-2 border-white text-white flex items-center justify-center shadow-xl">
                    <Eye className="w-5 h-5 text-[#E07A3F]" />
                  </div>
                </div>
                <div className="mt-1 bg-black/85 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/25 shadow-lg whitespace-nowrap">
                  Visão Frontal Padrão
                </div>
              </div>
            ) : isStep ? (
              /* Street View step disc */
              (() => {
                const sizeStyles = getArrowSizeStyles(arrowSize)
                const arrowRotationDeg = getArrowRotationDegrees(arrowOrientation, arrowRotation)

                return (
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`relative ${sizeStyles.discWidth} ${sizeStyles.discHeight} flex items-center justify-center`}
                    >
                      <div
                        className={`absolute ${sizeStyles.discHaloWidth} ${sizeStyles.discHaloHeight} rounded-[100%] bg-[#E07A3F]/35 border-2 border-white shadow-[0_0_12px_rgba(224,122,63,0.8)] animate-pulse`}
                      />
                      <div
                        className={`relative z-10 ${sizeStyles.arrowBtnSize} rounded-full bg-[#E07A3F] text-white flex items-center justify-center shadow-xl border-2 border-white`}
                      >
                        <svg
                          className={`${sizeStyles.iconSize} text-white transition-transform`}
                          style={{
                            transform: `rotate(${arrowRotationDeg}deg)`,
                          }}
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
                    <div
                      className={`mt-0.5 bg-black/85 backdrop-blur-md text-white ${sizeStyles.tooltipText} font-semibold rounded-full border border-white/25 shadow-lg whitespace-nowrap`}
                    >
                      {targetName || 'Próximo passo aqui'}
                    </div>
                  </div>
                )
              })()
            ) : (
              /* Door / Exit circular hotspot with live arrow size and rotation */
              (() => {
                const sizeStyles = getArrowSizeStyles(arrowSize)
                const arrowRotationDeg = getArrowRotationDegrees(arrowOrientation, arrowRotation)

                return (
                  <div className="relative flex flex-col items-center">
                    <div className="relative flex items-center justify-center">
                      <div
                        className={`absolute ${sizeStyles.doorPulseSize} rounded-full bg-[#1F4E5F]/40 animate-ping`}
                      />
                      <div
                        className={`${sizeStyles.doorBtnSize} rounded-full bg-[#1F4E5F] border-2 border-white text-white flex items-center justify-center shadow-2xl`}
                      >
                        <svg
                          className={`${sizeStyles.doorIconSize} text-white transition-transform`}
                          style={{
                            transform: `rotate(${arrowRotationDeg}deg)`,
                          }}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                      </div>
                    </div>
                    <div
                      className={`mt-1 bg-black/85 backdrop-blur-md text-white ${sizeStyles.tooltipText} font-semibold rounded-full border border-white/25 shadow-lg whitespace-nowrap`}
                    >
                      {targetName || 'Saída / Porta aqui'}
                    </div>
                  </div>
                )
              })()
            )}
          </div>
        </div>

        {/* Bottom instructions bar */}
        <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
          <div className="bg-black/75 backdrop-blur-md text-white text-[11px] px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 shadow">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>
              {mode === 'initial_view'
                ? 'Arraste o panorama até a mira central ficar na direção inicial de abertura'
                : 'Arraste o panorama esférico até a mira apontar para o destino'}
            </span>
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
            {mode === 'initial_view' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={resetInitialView}
                className="h-7 px-2 text-[10px] bg-black/70 hover:bg-black/90 text-[#E07A3F] font-bold rounded-lg border border-white/15"
                title="Zerar orientação inicial (Norte 0°)"
              >
                0°
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
