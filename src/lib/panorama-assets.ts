// High-quality equirectangular demo panorama URLs for standard real estate rooms
export const DEMO_PANORAMAS: Record<string, string> = {
  living: 'https://img.usecurling.com/p/2000/600?q=abstract',
  // High quality equirectangular public CC0/demo URLs:
  equirect_living: 'https://pannellum.org/images/alma.jpg',
  equirect_bedroom: 'https://pannellum.org/images/cerro-toco-0.jpg',
  equirect_suite: 'https://photo-sphere-viewer-data.netlify.app/assets/sphere.jpg',
  equirect_kitchen: 'https://pannellum.org/images/bma-0.jpg',
  equirect_rooftop: 'https://photo-sphere-viewer-data.netlify.app/assets/sphere-small.jpg',
  // Distinct panoramas for multiple points within same room (e.g. living room positions)
  equirect_dining: 'https://pannellum.org/images/bma-0.jpg',
  equirect_balcony: 'https://photo-sphere-viewer-data.netlify.app/assets/sphere-small.jpg',
}

/**
 * Returns a panorama URL for a room and/or nav point.
 * Priority:
 * 1. Uploaded PocketBase image file URL if exists
 * 2. Generated procedurally or high quality equirectangular demo panorama fallback based on point/room name
 */
export function getRoomPanoramaUrl(
  roomName: string,
  uploadedUrl?: string,
  pointName?: string,
): string {
  if (uploadedUrl && uploadedUrl.trim() !== '') {
    return uploadedUrl
  }

  const pName = (pointName || '').toLowerCase()
  const name = roomName.toLowerCase()

  // Specific check for point variations within a room
  if (pName.includes('jantar')) {
    return DEMO_PANORAMAS.equirect_dining
  }
  if (pName.includes('varanda') || pName.includes('sacada')) {
    return DEMO_PANORAMAS.equirect_balcony
  }

  if (
    name.includes('suíte') ||
    name.includes('suite') ||
    name.includes('quarto') ||
    name.includes('dormit')
  ) {
    return DEMO_PANORAMAS.equirect_suite
  }
  if (name.includes('cozinha') || name.includes('copa')) {
    return DEMO_PANORAMAS.equirect_kitchen
  }
  if (
    name.includes('rooftop') ||
    name.includes('terraço') ||
    name.includes('terraco') ||
    name.includes('jardim') ||
    name.includes('piscina') ||
    name.includes('varanda')
  ) {
    return DEMO_PANORAMAS.equirect_rooftop
  }
  if (name.includes('studio') || name.includes('banheiro')) {
    return DEMO_PANORAMAS.equirect_bedroom
  }
  // Default to living room
  return DEMO_PANORAMAS.equirect_living
}

/**
 * Procedural fallback canvas generator if network panorama cannot load
 */
export function generateProceduralPanorama(roomTitle: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Gradient background simulating room (ceiling, walls, floor)
  const grad = ctx.createLinearGradient(0, 0, 0, 1024)
  grad.addColorStop(0, '#EAE6E1') // ceiling
  grad.addColorStop(0.35, '#DFD9CE') // upper walls
  grad.addColorStop(0.55, '#D5CEC2') // eye level
  grad.addColorStop(0.7, '#A38B75') // floor wood
  grad.addColorStop(1, '#6F5642') // dark wood floor
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 2048, 1024)

  // Decorative architectural lines (walls & window frames)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 4

  // Window panels
  for (let x = 200; x < 800; x += 150) {
    ctx.fillStyle = 'rgba(210, 235, 250, 0.4)'
    ctx.fillRect(x, 280, 120, 360)
    ctx.strokeRect(x, 280, 120, 360)
  }

  // Baseboard & moldings
  ctx.fillStyle = 'rgba(50, 40, 35, 0.25)'
  ctx.fillRect(0, 680, 2048, 16)

  // Large Room Title in room
  ctx.fillStyle = 'rgba(31, 78, 95, 0.85)'
  ctx.font = 'bold 44px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`VISITA VIRTUAL 360°`, 1024, 420)

  ctx.fillStyle = 'rgba(28, 43, 54, 0.7)'
  ctx.font = '32px Inter, sans-serif'
  ctx.fillText(roomTitle, 1024, 480)

  ctx.fillStyle = 'rgba(224, 122, 63, 0.9)'
  ctx.font = '600 24px Inter, sans-serif'
  ctx.fillText('Arraste com o mouse ou toque para olhar ao redor em 360°', 1024, 530)

  return canvas.toDataURL('image/jpeg', 0.9)
}

/**
 * Interactive Demo Floor Plan SVG generator
 */
export function generateDemoFloorPlan(
  title: string,
  rooms: Array<{ id: string; name: string }>,
): string {
  // SVG Floor plan with interactive room areas
  const boxes = [
    { x: 40, y: 40, w: 260, h: 220, label: rooms[0]?.name || 'Living' },
    { x: 320, y: 40, w: 240, h: 140, label: rooms[1]?.name || 'Suíte Master' },
    { x: 320, y: 195, w: 240, h: 165, label: rooms[2]?.name || 'Cozinha Gourmet' },
    { x: 40, y: 275, w: 260, h: 145, label: 'Varanda / Circulação' },
  ]

  return `
    <svg viewBox="0 0 600 450" xmlns="http://www.w3.org/2000/svg" class="w-full h-full select-none">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E6E9" stroke-width="1"/>
        </pattern>
      </defs>
      <!-- Blueprint grid background -->
      <rect width="600" height="450" fill="#FAF9F6"/>
      <rect width="600" height="450" fill="url(#grid)" opacity="0.6"/>

      <!-- Outer perimeter walls -->
      <rect x="30" y="30" width="540" height="395" fill="none" stroke="#1F4E5F" stroke-width="8" rx="4"/>

      <!-- Interior rooms -->
      ${boxes
        .map(
          (b) => `
        <g>
          <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="white" stroke="#5B6B76" stroke-width="2" rx="2" opacity="0.85"/>
          <!-- Door swing arc -->
          <path d="M ${b.x + 20} ${b.y + b.h} A 30 30 0 0 1 ${b.x + 50} ${b.y + b.h - 30}" fill="none" stroke="#E07A3F" stroke-width="1.5" stroke-dasharray="3,3"/>
          <text x="${b.x + b.w / 2}" y="${b.y + b.h / 2}" fill="#1C2B36" font-family="Inter, sans-serif" font-size="13" font-weight="600" text-anchor="middle" dominant-baseline="middle">
            ${b.label}
          </text>
        </g>
      `,
        )
        .join('')}

      <!-- North arrow -->
      <g transform="translate(530, 70)">
        <circle cx="0" cy="0" r="18" fill="white" stroke="#1F4E5F" stroke-width="2"/>
        <path d="M 0 -12 L 5 4 L 0 1 L -5 4 Z" fill="#E07A3F"/>
        <text x="0" y="-15" font-family="Inter" font-size="10" font-weight="700" fill="#1F4E5F" text-anchor="middle">N</text>
      </g>
    </svg>
  `
}
