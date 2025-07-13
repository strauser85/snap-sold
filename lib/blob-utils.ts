// Utility functions to handle blob storage issues

export async function createSafeVideoBlob(chunks: Blob[]): Promise<string> {
  try {
    console.log(`Creating video blob from ${chunks.length} chunks`)

    // Check if we have any chunks
    if (chunks.length === 0) {
      throw new Error("No video chunks available - recording may have failed")
    }

    // Calculate total size
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0)
    console.log(`Total video data: ${totalSize} bytes`)

    if (totalSize === 0) {
      throw new Error("All video chunks are empty - no video data recorded")
    }

    // Try different MIME types for better compatibility
    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ]

    let videoBlob: Blob | null = null
    let usedMimeType = ""

    for (const mimeType of mimeTypes) {
      try {
        videoBlob = new Blob(chunks, { type: mimeType })
        if (videoBlob.size > 0) {
          usedMimeType = mimeType
          console.log(`Successfully created blob with ${mimeType}: ${videoBlob.size} bytes`)
          break
        }
      } catch (error) {
        console.log(`Failed to create blob with ${mimeType}:`, error)
        continue
      }
    }

    if (!videoBlob || videoBlob.size === 0) {
      throw new Error("Failed to create valid video blob with any MIME type")
    }

    console.log(`Final video blob: ${videoBlob.size} bytes, type: ${usedMimeType}`)

    // Create object URL
    const url = URL.createObjectURL(videoBlob)

    // Test the URL briefly
    const testResult = await testVideoUrl(url)
    if (!testResult) {
      console.warn("Video URL test failed, but proceeding anyway")
    }

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
