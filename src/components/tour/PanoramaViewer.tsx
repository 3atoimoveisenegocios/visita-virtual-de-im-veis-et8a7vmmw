import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { generateProceduralPanorama } from '@/lib/panorama-assets'
import {
  DEFAULT_PANORAMA_FOV,
  MIN_PANORAMA_FOV,
  MAX_PANORAMA_FOV,
  LITTLE_PLANET_FOV,
  CRYSTAL_BALL_FOV,
  MIN_PITCH_DEG,
  MAX_PITCH_DEG,
  PanoramaProjectionMode,
  isWebGLAvailable,
  projectSphericalToScreen,
  sphericalToVector3,
} from '@/lib/panorama-spherical'
import type { Hotspot } from '@/types'
import {
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Smartphone,
  Globe,
  Disc,
  Eye,
} from 'lucide-react'

interface PanoramaViewerProps {
  imageUrl: string
  roomName: string
  pointName?: string
  hotspots: Hotspot[]
  onHotspotClick: (hotspot: Hotspot) => void
  isLoading?: boolean
  initialYaw?: number
  initialPitch?: number
}

interface VisibleHotspotItem {
  hotspot: Hotspot
  x: number
  y: number
  visible: boolean
}

export const PanoramaViewer: React.FC<PanoramaViewerProps> = ({
  imageUrl,
  roomName,
  pointName,
  hotspots,
  onHotspotClick,
  isLoading = false,
  initialYaw = 0,
  initialPitch = 0,
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [webglSupported, setWebglSupported] = useState(true)

  // Spherical camera orientation & FOV state
  // yaw: 0..360, pitch: -89.5..89.5 (degrees) - Full 180° vertical pan
  // FOV limits: 45° (zoomed-in) to 110° (wide angle, prevents pole/nadir distortion). Initial: 75°.
  const parsedInitialYaw =
    initialYaw !== undefined && initialYaw !== null && !isNaN(Number(initialYaw))
      ? (Number(initialYaw) + 360) % 360
      : 0
  const parsedInitialPitch =
    initialPitch !== undefined && initialPitch !== null && !isNaN(Number(initialPitch))
      ? Math.max(MIN_PITCH_DEG, Math.min(MAX_PITCH_DEG, Number(initialPitch)))
      : 0

  const yawRef = useRef<number>(parsedInitialYaw)
  const pitchRef = useRef<number>(parsedInitialPitch)
  const fovRef = useRef<number>(DEFAULT_PANORAMA_FOV)

  // Projection mode state: normal (equirectangular perspective) | little_planet | crystal_ball
  const [projectionMode, setProjectionMode] = useState<PanoramaProjectionMode>('normal')

  // Gyroscope / DeviceOrientation state (mobile optional, off by default)
  const [gyroActive, setGyroActive] = useState<boolean>(false)
  const [hasGyroSupport, setHasGyroSupport] = useState<boolean>(false)
  const gyroBaseRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null)
  const gyroYawOffsetRef = useRef<number>(0)
  const gyroPitchOffsetRef = useRef<number>(0)

  // Drag interaction, inertia and touch pinch state
  const isDraggingRef = useRef<boolean>(false)
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 })
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const initialPinchDistRef = useRef<number | null>(null)
  const initialPinchFovRef = useRef<number>(DEFAULT_PANORAMA_FOV)
  const isPinchingRef = useRef<boolean>(false)
  const pinchStartTimestampRef = useRef<number>(0)

  // Hotspots projected in 2D coordinates
  const [visibleHotspots, setVisibleHotspots] = useState<VisibleHotspotItem[]>([])

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

  // Detect gyroscope availability on device
  useEffect(() => {
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      setHasGyroSupport(true)
    }
  }, [])

  // On image or point change: initialize yaw and pitch to administrator defined frontal view
  useEffect(() => {
    const targetYaw = initialYaw !== undefined && initialYaw !== null ? (initialYaw + 360) % 360 : 0
    const targetPitch =
      initialPitch !== undefined && initialPitch !== null
        ? Math.max(MIN_PITCH_DEG, Math.min(MAX_PITCH_DEG, initialPitch))
        : 0
    yawRef.current = targetYaw
    pitchRef.current = targetPitch
    if (fovRef.current < DEFAULT_PANORAMA_FOV && projectionMode === 'normal') {
      fovRef.current = DEFAULT_PANORAMA_FOV
    }
  }, [imageUrl, pointName, initialPitch])

  // Initial WebGL capability check
  useEffect(() => {
    setWebglSupported(isWebGLAvailable())
  }, [])

  // Initialize Three.js scene, camera, sphere and render loop
  useEffect(() => {
    const container = mountRef.current
    if (!container || !webglSupported) return

    const width = container.clientWidth || 800
    const height = container.clientHeight || 600

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

    // Sphere geometry with inward faces:
    // radius: 500, widthSegments: 64, heightSegments: 32
    // scale(-1, 1, 1) inverts normals so the equirectangular panorama texture is mapped inside the sphere
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

    // Resize observer to keep aspect ratio and renderer pixel dimensions crisp
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

    // Main render & update loop
    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)

      // Apply drag inertia when not interacting
      if (!isDraggingRef.current) {
        yawRef.current = (yawRef.current - velocityRef.current.vx + 360) % 360
        pitchRef.current = Math.max(
          MIN_PITCH_DEG,
          Math.min(MAX_PITCH_DEG, pitchRef.current + velocityRef.current.vy),
        )
        velocityRef.current.vx *= 0.92
        velocityRef.current.vy *= 0.92
        if (Math.abs(velocityRef.current.vx) < 0.001) velocityRef.current.vx = 0
        if (Math.abs(velocityRef.current.vy) < 0.001) velocityRef.current.vy = 0
      }

      // Update camera FOV smoothly
      if (Math.abs(camera.fov - fovRef.current) > 0.01) {
        camera.fov = fovRef.current
        camera.updateProjectionMatrix()
      }

      // Point camera according to yaw & pitch
      const lookTarget = sphericalToVector3(yawRef.current, pitchRef.current, 500)
      camera.lookAt(lookTarget)

      renderer.render(scene, camera)

      // Calculate mathematically accurate 2D screen projections for hotspots on the sphere
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        const curW = container.clientWidth
        const curH = container.clientHeight
        const activeHotspots = (mesh.userData.hotspots as Hotspot[]) || []

        const projectedList: VisibleHotspotItem[] = activeHotspots.map((hs) => {
          // Standard real estate hotspots are located at floor/mid height level
          // Direction is horizontal yaw (0..360). For step markers, pitch is slightly down (~ -16°);
          // for door/room exits, pitch is around horizontal horizon (~ -4°).
          const isStep =
            hs.type === 'step' || (hs.room === hs.target_room && Boolean(hs.target_nav_point))
          const hsPitch = isStep ? -16 : -4

          const proj = projectSphericalToScreen(hs.direction, hsPitch, camera, curW, curH, 500)

          return {
            hotspot: hs,
            x: proj.x,
            y: proj.y,
            visible: proj.visible,
          }
        })

        setVisibleHotspots(projectedList)
      }
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

  // Keep hotspots in sync with the Three.js mesh userData
  useEffect(() => {
    if (threeRefs.current.mesh) {
      threeRefs.current.mesh.userData.hotspots = hotspots
    }
  }, [hotspots])

  // Load and apply Equirectangular 2:1 panorama texture
  useEffect(() => {
    setImageLoaded(false)

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
      const fallbackUrl = generateProceduralPanorama(roomName)
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

    // Try loading source panorama
    textureLoader.load(
      imageUrl,
      (loadedTex) => {
        applyTexture(loadedTex)
      },
      undefined,
      () => {
        if (isCancelled) return
        loadFallbackProcedural()
      },
    )

    return () => {
      isCancelled = true
    }
  }, [imageUrl, roomName])

  // Pointer event handlers (Mouse drag, Touch pan, Pinch-to-zoom)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest('.interactive-hotspot') ||
      (e.target as HTMLElement).closest('.no-pan')
    ) {
      return
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointersRef.current.size === 1) {
      isDraggingRef.current = true
      isPinchingRef.current = false
      initialPinchDistRef.current = null
      lastMousePosRef.current = { x: e.clientX, y: e.clientY }
      velocityRef.current = { vx: 0, vy: 0 }
    } else if (activePointersRef.current.size === 2) {
      // Second finger touched: pause single-finger drag
      isDraggingRef.current = false
      velocityRef.current = { vx: 0, vy: 0 }
      const pts = Array.from(activePointersRef.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      initialPinchDistRef.current = dist
      initialPinchFovRef.current = fovRef.current
      isPinchingRef.current = false // Will activate only after passing movement threshold
      pinchStartTimestampRef.current = Date.now()
    } else {
      // 3 or more fingers: cancel both pinch and drag
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
      // (prevents accidental zoom when resting second finger or brushing touchpad)
      if (!isPinchingRef.current) {
        if (distDiff >= 12) {
          isPinchingRef.current = true
          // Reset initial reference to current point to avoid jump
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

    // Adaptive sensitivity: lower FOV (zoomed-in) moves slower and more accurately
    const sensitivity = (fovRef.current / 75) * 0.22
    const deltaYaw = dx * sensitivity
    const deltaPitch = dy * sensitivity * 0.65

    yawRef.current = (yawRef.current - deltaYaw + 360) % 360
    pitchRef.current = Math.max(
      MIN_PITCH_DEG,
      Math.min(MAX_PITCH_DEG, pitchRef.current + deltaPitch),
    )

    velocityRef.current = { vx: deltaYaw * 0.35, vy: deltaPitch * 0.35 }
    lastMousePosRef.current = { x: e.clientX, y: e.clientY }
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
      // Re-enable dragging with single remaining pointer, resetting velocity
      isDraggingRef.current = true
      velocityRef.current = { vx: 0, vy: 0 }
    } else {
      isDraggingRef.current = false
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
      // Locked FOV during active drag: ignore zoom if user is currently dragging with pointer
      if (isDraggingRef.current || activePointersRef.current.size > 0) return

      const zoomDelta = e.deltaY > 0 ? 5 : -5
      fovRef.current = Math.max(
        MIN_PANORAMA_FOV,
        Math.min(MAX_PANORAMA_FOV, fovRef.current + zoomDelta),
      )
      return
    }

    // Google Street View behavior: two-finger touchpad or mouse wheel rotates view
    // deltaX rotates yaw (horizontal pan)
    // deltaY tilts pitch (vertical tilt)
    const factor = (fovRef.current / 75) * 0.12
    const deltaYaw = e.deltaX * factor
    const deltaPitch = -e.deltaY * factor * 0.65

    yawRef.current = (yawRef.current - deltaYaw + 360) % 360
    pitchRef.current = Math.max(
      MIN_PITCH_DEG,
      Math.min(MAX_PITCH_DEG, pitchRef.current + deltaPitch),
    )
  }

  // Floating zoom & reset controls
  const zoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    fovRef.current = Math.max(MIN_PANORAMA_FOV, Math.min(MAX_PANORAMA_FOV, fovRef.current - 10))
  }

  const zoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    fovRef.current = Math.max(MIN_PANORAMA_FOV, Math.min(MAX_PANORAMA_FOV, fovRef.current + 10))
  }

  const resetView = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setProjectionMode('normal')
    fovRef.current = DEFAULT_PANORAMA_FOV
    const targetYaw = initialYaw !== undefined && initialYaw !== null ? (initialYaw + 360) % 360 : 0
    const targetPitch =
      initialPitch !== undefined && initialPitch !== null
        ? Math.max(MIN_PITCH_DEG, Math.min(MAX_PITCH_DEG, initialPitch))
        : 0
    yawRef.current = targetYaw
    pitchRef.current = targetPitch
  }

  // Toggle optional Projection Modes (Normal Perspective -> Little Planet -> Crystal Ball)
  const toggleProjectionMode = (mode: PanoramaProjectionMode) => {
    setProjectionMode(mode)
    if (mode === 'little_planet') {
      // Little Planet: stereographic wide nadir view looking directly down
      fovRef.current = LITTLE_PLANET_FOV
      pitchRef.current = -88
    } else if (mode === 'crystal_ball') {
      // Crystal Ball: inverted stereographic look directly up at zenith
      fovRef.current = CRYSTAL_BALL_FOV
      pitchRef.current = 88
    } else {
      // Normal Perspective (default)
      fovRef.current = DEFAULT_PANORAMA_FOV
      pitchRef.current = initialPitch !== undefined ? initialPitch : 0
    }
  }

  // Toggle optional Gyroscope with iOS permission request
  const toggleGyroscope = async () => {
    if (gyroActive) {
      setGyroActive(false)
      window.removeEventListener('deviceorientation', handleDeviceOrientation)
      return
    }

    // iOS 13+ DeviceOrientationEvent permission request
    const doe = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }
    if (typeof doe.requestPermission === 'function') {
      try {
        const response = await doe.requestPermission()
        if (response !== 'granted') {
          return
        }
      } catch (err) {
        console.warn('Permissão de giroscópio negada ou não suportada:', err)
        return
      }
    }

    gyroBaseRef.current = null
    gyroYawOffsetRef.current = yawRef.current
    gyroPitchOffsetRef.current = pitchRef.current
    setGyroActive(true)
    window.addEventListener('deviceorientation', handleDeviceOrientation, true)
  }

  const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha === null || event.beta === null || event.gamma === null) return

    if (!gyroBaseRef.current) {
      gyroBaseRef.current = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      }
      return
    }

    // Alpha: rotation around Z axis (compass heading 0..360)
    // Beta: front-to-back tilt (-180..180)
    const deltaAlpha = event.alpha - gyroBaseRef.current.alpha
    const deltaBeta = event.beta - gyroBaseRef.current.beta

    // Smooth update of yaw and pitch from device orientation
    if (!isDraggingRef.current) {
      yawRef.current = (gyroYawOffsetRef.current - deltaAlpha + 360) % 360
      const newPitch = gyroPitchOffsetRef.current + (deltaBeta - 45) // 45° natural phone holding angle
      pitchRef.current = Math.max(MIN_PITCH_DEG, Math.min(MAX_PITCH_DEG, newPitch))
    }
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation)
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-black"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
    >
      {/* Floating On-Screen Controls (Zoom, Reset, Gyroscope & Projection Modes) */}
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
          title="Redefinir visão frontal (padrão)"
          aria-label="Redefinir visão frontal"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#E07A3F]" />
        </button>

        {/* Gyroscope toggle (optional on mobile/touch, never default) */}
        {hasGyroSupport && (
          <button
            type="button"
            onClick={toggleGyroscope}
            className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center shadow-lg transition-all active:scale-95 ${
              gyroActive
                ? 'bg-[#E07A3F] border-white text-white'
                : 'bg-[rgba(15,23,32,0.78)] hover:bg-[rgba(15,23,32,0.95)] border-white/15 text-white/80'
            }`}
            title={gyroActive ? 'Desativar giroscópio' : 'Ativar giroscópio (mover celular)'}
            aria-label="Controle por giroscópio"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        )}

        {/* Projection Mode Switcher: Perspective Normal / Little Planet / Crystal Ball (optional, never default) */}
        <div className="pt-1 flex flex-col gap-1.5 border-t border-white/10 mt-1">
          <button
            type="button"
            onClick={() =>
              toggleProjectionMode(
                projectionMode === 'normal'
                  ? 'little_planet'
                  : projectionMode === 'little_planet'
                    ? 'crystal_ball'
                    : 'normal',
              )
            }
            className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center shadow-lg transition-all active:scale-95 ${
              projectionMode !== 'normal'
                ? 'bg-[#1F4E5F] border-white text-white'
                : 'bg-[rgba(15,23,32,0.78)] hover:bg-[rgba(15,23,32,0.95)] border-white/15 text-white/70'
            }`}
            title={`Modo de Projeção atual: ${
              projectionMode === 'normal'
                ? 'Perspectiva Equiretangular (Padrão Insta360)'
                : projectionMode === 'little_planet'
                  ? 'Little Planet (Pequeno Planeta)'
                  : 'Crystal Ball (Bola de Cristal)'
            }`}
            aria-label="Alterar modo de projeção"
          >
            {projectionMode === 'normal' && <Eye className="w-4 h-4 text-white" />}
            {projectionMode === 'little_planet' && <Globe className="w-4 h-4 text-emerald-300" />}
            {projectionMode === 'crystal_ball' && <Disc className="w-4 h-4 text-cyan-300" />}
          </button>
        </div>
      </div>

      {/* Floating active projection mode indicator (when non-standard) */}
      {projectionMode !== 'normal' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-md text-white text-xs px-3.5 py-1.5 rounded-full border border-white/20 shadow-xl flex items-center gap-2 pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>
            {projectionMode === 'little_planet' ? 'Modo Little Planet' : 'Modo Crystal Ball'}
          </span>
          <button
            type="button"
            onClick={() => toggleProjectionMode('normal')}
            className="ml-1 text-[11px] underline text-[#E07A3F] hover:text-white"
          >
            Voltar ao normal
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {(isLoading || !imageLoaded) && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20 pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-[#E07A3F] rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium tracking-wide">
            Carregando visualização 360° esférica...
          </p>
          <span className="text-xs text-white/60 mt-1">
            {roomName} {pointName ? `• ${pointName}` : ''}
          </span>
        </div>
      )}

      {/* Fallback notification if WebGL is unavailable on old devices */}
      {!webglSupported && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-white p-6 z-30">
          <div className="text-center max-w-md">
            <h3 className="text-lg font-bold mb-2">Aceleração WebGL não disponível</h3>
            <p className="text-xs text-white/70">
              Para visualizar o tour 360° com projeção esférica real, utilize um navegador moderno
              com aceleração de hardware ativada.
            </p>
          </div>
        </div>
      )}

      {/* Interactive Navigation Hotspots mathematically projected onto the sphere (hidden in little planet/crystal ball) */}
      {imageLoaded &&
        projectionMode === 'normal' &&
        visibleHotspots
          .filter((item) => item.visible)
          .map((item) => {
            const isStep =
              item.hotspot.type === 'step' ||
              (item.hotspot.room === item.hotspot.target_room &&
                Boolean(item.hotspot.target_nav_point))
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
                  /* Street View style displacement arrow / floor disc */
                  <div className="relative flex flex-col items-center justify-center">
                    {/* Perspective floor disc */}
                    <div className="relative w-16 h-12 flex items-center justify-center">
                      <div className="absolute w-16 h-8 rounded-[100%] bg-white/25 border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.6)] animate-pulse pointer-events-none transition-transform group-hover:scale-110 group-hover:bg-[#E07A3F]/40 group-hover:border-[#E07A3F]" />
                      <div className="relative z-10 w-9 h-9 rounded-full bg-[#E07A3F] text-white flex items-center justify-center shadow-xl border-2 border-white group-hover:scale-110 transition-transform">
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
