// MLS API Configuration
export const MLS_CONFIG = {
  // Bridge API Configuration
  BRIDGE: {
    baseUrl: "https://api.bridgedataoutput.com/api/v2",
    endpoints: {
      properties: "/pub/properties",
      photos: "/pub/photos",
    },
  },

  // RETS Configuration (as fallback)
  RETS: {
    version: "RETS/1.7.2",
    userAgent: "SnapSold/1.0",
    searchTypes: {
      property: "Property",
      photos: "Photo",
    },
  },
}

// Validate required environment variables
export function validateMLSConfig() {
  const required = ["BRIDGE_API_TOKEN"]
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    console.warn(`Missing MLS configuration: ${missing.join(", ")}`)
    return false
  }

  return true
}

// Get MLS provider status
export function getMLSProviderStatus() {
  return {
    bridge: !!process.env.BRIDGE_API_TOKEN,
    rets: !!(process.env.RETS_LOGIN_URL && process.env.RETS_USERNAME && process.env.RETS_PASSWORD),
    fal: !!process.env.FAL_KEY,
  }
}
