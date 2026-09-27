/**
 * Lightweight helper to inspect panoramic images (XMP / GPano metadata and 2:1 aspect ratio)
 * conforming to Insta360 specifications (Photo 360 / Equirectangular).
 * References:
 * - Insta360 XMP file info: GPano:ProjectionType="equirectangular", GPano:UsePanoramaViewer="True"
 * - Aspect ratio: ~2:1 (e.g. 5760x2880, 6080x3040, 7680x3840, 11968x5984)
 */

export interface PanoramaInspectionResult {
  isEquirectangular: boolean
  hasXmpMetadata: boolean
  hasGPanoProjection: boolean
  projectionType?: string
  width?: number
  height?: number
  aspectRatio?: number
  isApprox2to1: boolean
  warningMessage?: string
  insta360Hint?: string
}

/**
 * Reads the first slice (up to 128KB) of an image file to check for XMP / GPano tags.
 */
export async function inspectPanoramaFile(file: File): Promise<PanoramaInspectionResult> {
  let hasXmpMetadata = false
  let hasGPanoProjection = false
  let projectionType: string | undefined

  try {
    // Read first 131072 bytes (128 KB) where APP1 / XMP blocks live in JPEG/PNG/WebP
    const headerSlice = file.slice(0, 131072)
    const arrayBuffer = await headerSlice.arrayBuffer()
    const decoder = new TextDecoder('latin1')
    const rawText = decoder.decode(arrayBuffer)

    // Check for XMP markers
    if (rawText.includes('<x:xmpmeta') || rawText.includes('http://ns.adobe.com/xap/1.0/')) {
      hasXmpMetadata = true
    }

    // Check for GPano tags (Google Photo Sphere / Insta360 XMP standard)
    // Matches GPano:ProjectionType="equirectangular" or GPano:ProjectionType='equirectangular'
    // or GPano:UsePanoramaViewer="True"
    const projectionMatch = rawText.match(/GPano:ProjectionType=["']?([^"'\s>]+)/i)
    if (projectionMatch && projectionMatch[1]) {
      projectionType = projectionMatch[1]
      if (projectionType.toLowerCase() === 'equirectangular') {
        hasGPanoProjection = true
      }
    }

    if (rawText.includes('GPano:UsePanoramaViewer') || rawText.includes('equirectangular')) {
      hasGPanoProjection = true
    }
  } catch (err) {
    console.warn('Falha na leitura XMP do arquivo:', err)
  }

  // Check dimensions & aspect ratio using Image element
  let width = 0
  let height = 0
  let isApprox2to1 = false
  let aspectRatio = 0

  try {
    const dimensions = await getImageDimensions(file)
    width = dimensions.width
    height = dimensions.height
    if (height > 0) {
      aspectRatio = width / height
      // 2:1 ratio allow margin between 1.90 and 2.10
      isApprox2to1 = Math.abs(aspectRatio - 2.0) <= 0.12
    }
  } catch (err) {
    console.warn('Falha na leitura das dimensões da imagem:', err)
  }

  const isEquirectangular = hasGPanoProjection || isApprox2to1

  let warningMessage: string | undefined
  let insta360Hint: string | undefined

  if (!isEquirectangular) {
    warningMessage =
      'A imagem selecionada não possui proporção 2:1 nem metadados XMP de foto equirectangular 360°.'
    insta360Hint =
      'Dica Insta360: No app Insta360 (celular ou Insta360 Studio no PC), certifique-se de exportar a imagem no modo "Foto 360" (Equirectangular 2:1), e não como foto plana reenquadrada.'
  } else if (!hasGPanoProjection && isApprox2to1) {
    insta360Hint =
      'Proporção 2:1 detectada. Os metadados XMP da Insta360 serão renderizados em projeção esférica contínua de 360° x 180°.'
  } else if (hasGPanoProjection) {
    insta360Hint = 'Metadados Insta360/GPano (Equirectangular 360°) reconhecidos com sucesso!'
  }

  return {
    isEquirectangular,
    hasXmpMetadata,
    hasGPanoProjection,
    projectionType,
    width,
    height,
    aspectRatio,
    isApprox2to1,
    warningMessage,
    insta360Hint,
  }
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível carregar a imagem para obter dimensões'))
    }
    img.src = url
  })
}
