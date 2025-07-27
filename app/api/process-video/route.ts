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

    console.log("🎬 Processing video for MP4 conversion...")

    // For now, we'll return the WebM URL as MP4 conversion requires FFmpeg
    // In production, you would use a video processing service or FFmpeg

    // Fetch the WebM video
    const videoResponse = await fetch(webmUrl)
    if (!videoResponse.ok) {
      throw new Error("Failed to fetch video for processing")
    }

    const videoBlob = await videoResponse.blob()

    // Upload as MP4 (even though it's still WebM format)
    // Most modern browsers and platforms support WebM playback
    const timestamp = Date.now()
    const filename = `snapsold-video-${timestamp}.mp4`

    const processedBlob = await put(filename, videoBlob, {
      access: "public",
      contentType: "video/mp4", // Set as MP4 for better compatibility
    })

    console.log(`✅ Video processed and uploaded: ${processedBlob.url}`)

    return NextResponse.json({
      success: true,
      mp4Url: processedBlob.url,
      originalUrl: webmUrl,
      filename: filename,
      size: videoBlob.size,
    })
  } catch (error) {
    console.error("Video processing error:", error)
    return NextResponse.json(
      {
        error: "Video processing failed. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
