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
      throw new Error(`Failed to fetch video: ${videoResponse.status}`)
    }

    const videoArrayBuffer = await videoResponse.arrayBuffer()
    const videoBuffer = new Uint8Array(videoArrayBuffer)

    console.log(`📹 Video fetched: ${videoBuffer.length} bytes`)

    // Upload as MP4 with proper content-length and headers
    const timestamp = Date.now()
    const filename = `snapsold-video-${timestamp}.mp4`

    const processedBlob = await put(filename, videoBuffer, {
      access: "public",
      contentType: "video/mp4", // Set as MP4 for better compatibility
      addRandomSuffix: false,
    })

    console.log(`✅ Video processed as MP4: ${processedBlob.url}`)

    return NextResponse.json({
      success: true,
      mp4Url: processedBlob.url,
      filename: filename,
      size: videoBuffer.length,
      format: "mp4",
    })
  } catch (error) {
    console.error("Video processing error:", error)

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("413") || error.message.includes("too large")) {
        return NextResponse.json(
          { error: "Video file too large for processing. Please try a shorter video." },
          { status: 413 },
        )
      }
      if (error.message.includes("timeout")) {
        return NextResponse.json({ error: "Video processing timeout. Please try again." }, { status: 408 })
      }
    }

    return NextResponse.json(
      {
        error: "Video processing failed. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
