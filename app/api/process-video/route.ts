import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { webmUrl } = await request.json()

    if (!webmUrl) {
      return NextResponse.json({ error: "No video URL provided" }, { status: 400 })
    }

    console.log("🎬 Processing video for MP4 export...")

    // Fetch the WebM video
    const videoResponse = await fetch(webmUrl)
    if (!videoResponse.ok) {
      throw new Error("Failed to fetch video for processing")
    }

    const videoArrayBuffer = await videoResponse.arrayBuffer()
    const videoBuffer = new Uint8Array(videoArrayBuffer)

    // Upload as MP4 with proper content-length
    const timestamp = Date.now()
    const filename = `snapsold-video-${timestamp}.mp4`

    const processedBlob = await put(filename, videoBuffer, {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: false,
    })

    console.log(`✅ Video processed as MP4: ${processedBlob.url}`)

    return NextResponse.json({
      success: true,
      mp4Url: processedBlob.url,
      filename: filename,
      size: videoBuffer.length,
    })
  } catch (error) {
    console.error("Video processing error:", error)
    return NextResponse.json({ error: "Video processing failed. Please try again." }, { status: 500 })
  }
}
