/**
 * Set authentication token in localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", token)
  }
}

/**
 * Get authentication token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("auth_token")
  }
  return null
}

/**
 * Remove authentication token
 */
export function removeAuthToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token")
  }
}

/**
 * Decode JWT token (basic JWT decoding without verification)
 * Note: This is a client-side decode only, server should verify token
 */
export function decodeToken(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error("Failed to decode token:", error)
    return null
  }
}

/**
 * Get authorization header with token
 */
export function getAuthHeader(): Record<string, string> {
  const token = getAuthToken()
  if (!token) {
    return {}
  }
  return {
    Authorization: `Bearer ${token}`,
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token)
  if (!decoded || !decoded.exp) {
    return true
  }

  const currentTime = Math.floor(Date.now() / 1000)
  return decoded.exp < currentTime
}
