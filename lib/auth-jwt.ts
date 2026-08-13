// Custom JWT using Web Crypto API (fully compatible with Node.js & Next.js Edge runtime Middleware)
// Has zero external dependencies and doesn't import Node's 'crypto' library.

export async function signJWT(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const header = { alg: 'HS256', typ: 'JWT' }
  
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    
  const encodedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    
  const tokenData = `${encodedHeader}.${encodedPayload}`
  
  // Use global crypto.subtle (available on all modern JS environments, standard in Edge runtime)
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(tokenData)
  )
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    
  return `${tokenData}.${encodedSignature}`
}

export async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const [header, payload, signature] = parts
    const tokenData = `${header}.${payload}`
    
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    
    // Decode base64url signature
    const signatureBase64 = signature.replace(/-/g, '+').replace(/_/g, '/')
    const signatureBinary = atob(signatureBase64)
    const signatureBytes = new Uint8Array(signatureBinary.length)
    for (let i = 0; i < signatureBinary.length; i++) {
      signatureBytes[i] = signatureBinary.charCodeAt(i)
    }
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(tokenData)
    )
    
    if (!isValid) return null
    
    // Decode payload
    const payloadBase64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decodedPayload = JSON.parse(
      decodeURIComponent(escape(atob(payloadBase64)))
    )
    
    // Check expiration
    if (decodedPayload.exp && Date.now() > decodedPayload.exp) {
      return null
    }
    
    return decodedPayload
  } catch (error) {
    return null
  }
}
