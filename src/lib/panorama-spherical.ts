import * as THREE from 'three'

export const DEFAULT_PANORAMA_FOV = 75
export const MIN_PANORAMA_FOV = 45
export const MAX_PANORAMA_FOV = 110

// Little Planet & Crystal Ball FOV presets
export const LITTLE_PLANET_FOV = 135
export const CRYSTAL_BALL_FOV = 135

// Vertical pitch limits: allows virtually full 180° pan (-89.5° to 89.5°)
// preserving gimbal clamp to avoid flipping the pole
export const MIN_PITCH_DEG = -89.5
export const MAX_PITCH_DEG = 89.5

export type PanoramaProjectionMode = 'normal' | 'little_planet' | 'crystal_ball'

/**
 * Checks if WebGL is supported by the current browser environment.
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    )
  } catch {
    return false
  }
}

/**
 * Converts spherical coordinates (yaw 0..360, pitch -90..90) to a unit direction vector in 3D.
 * Standard panorama convention:
 * - yaw = 0: looking towards -Z
 * - yaw = 90: looking towards +X (East / right)
 * - yaw = 180: looking towards +Z (South / back)
 * - yaw = 270: looking towards -X (West / left)
 * - pitch = 0: horizontal horizon
 * - pitch = +90: zenith (up)
 * - pitch = -90: nadir (down)
 */
export function sphericalToVector3(yawDeg: number, pitchDeg: number, radius = 500): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - pitchDeg) // from +Y (zenith) down to -Y (nadir)
  const theta = THREE.MathUtils.degToRad(yawDeg + 180) // 0 yaw points along -Z

  const x = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.cos(theta)

  return new THREE.Vector3(x, y, z)
}

/**
 * Projects a 3D hotspot or target heading (yaw & pitch) to 2D screen coordinates,
 * taking into account camera orientation and current FOV.
 *
 * Returns { x, y, visible } where visible is false if the point is behind the camera.
 */
export function projectSphericalToScreen(
  yawDeg: number,
  pitchDeg: number,
  camera: THREE.PerspectiveCamera,
  containerWidth: number,
  containerHeight: number,
  radius = 500,
): { x: number; y: number; visible: boolean; distToCenterNorm: number } {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, visible: false, distToCenterNorm: 999 }
  }

  const worldPos = sphericalToVector3(yawDeg, pitchDeg, radius)
  const projected = worldPos.clone().project(camera)

  // In Normalized Device Coordinates (NDC):
  // - projected.z < 1 means the point is in front of the far plane (and positive direction of camera)
  // - projected.x in [-1, 1] is within the horizontal viewport
  // - projected.y in [-1, 1] is within the vertical viewport
  const isFront = projected.z < 1

  // Map NDC [-1, 1] to screen pixels [0, width] and [0, height]
  const screenX = ((projected.x + 1) / 2) * containerWidth
  const screenY = ((-projected.y + 1) / 2) * containerHeight

  // Allow some margin around the screen edges for smooth entry/exit
  const margin = 80
  const isWithinScreen =
    screenX >= -margin &&
    screenX <= containerWidth + margin &&
    screenY >= -margin &&
    screenY <= containerHeight + margin

  const distToCenterNorm = Math.hypot(projected.x, projected.y)

  return {
    x: screenX,
    y: screenY,
    visible: isFront && isWithinScreen,
    distToCenterNorm,
  }
}
