const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** base64 string from Rust -> File object for SuperDoc */
export function base64ToFile(base64, filename) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: DOCX_MIME })
  return new File([blob], filename, { type: DOCX_MIME })
}

/** base64 string -> Uint8Array (for JSZip parsing) */
export function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Blob from SuperDoc export -> base64 string for Rust */
export async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}
