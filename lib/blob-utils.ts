// Utility functions to handle blob storage issues

export async function createSafeVideoBlob(chunks: Blob[]): Promise<string> {
  try {
    // Create video blob with proper MIME type
    const videoBlob = new Blob(chunks, {
      type: "video/webm;codecs=vp9,opus",
    })

    // Verify blob is valid
    if (videoBlob.size === 0) {
      throw new Error("Empty video blob created")
    }

    console.log(`Safe video blob created: ${videoBlob.size} bytes`)

    // Create object URL
    const url = URL.createObjectURL(videoBlob)

    // Test the URL to ensure it works
    await testVideoUrl(url)

    return url
  } catch (error) {
    console.error("Safe video blob creation failed:", error)
    throw error
  }
}

export async function testVideoUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.preload = "metadata"

    video.onloadedmetadata = () => {
      console.log(`Video URL test passed: ${video.duration}s duration`)
      resolve(true)
    }

    video.onerror = (error) => {
      console.error("Video URL test failed:", error)
      resolve(false)
    }

    // Set a timeout to prevent hanging
    setTimeout(() => {
      console.warn("Video URL test timeout")
      resolve(false)
    }, 5000)

    video.src = url
  })
}

export function fixBlobUrl(originalUrl: string): string {
  // If it's already a blob URL, return as-is
  if (originalUrl.startsWith("blob:")) {
    return originalUrl
  }

  // If it's a Vercel blob URL, add CORS proxy
  if (originalUrl.includes("blob.vercel-storage.com")) {
    return `/api/fix-blob-cors?url=${encodeURIComponent(originalUrl)}`
  }

  return originalUrl
}

export async function downloadBlobSafely(url: string, filename: string) {
  try {
    // Test if direct download works
    const link = document.createElement("a")
    link.href = url
    link.download = filename

    // Try direct download first
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    console.log(`Safe download initiated: ${filename}`)
  } catch (error) {
    console.error("Safe download failed:", error)

    // Fallback: open in new tab
    window.open(url, "_blank")
  }
}
