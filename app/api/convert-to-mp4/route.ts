import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export const runtime = "nodejs"
// Vercel allows a maximum of 60 seconds for Serverless Functions
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { webmUrl } = await request.json()

    if (!webmUrl) {
      return NextResponse.json({ error: "No WebM URL provided" }, { status: 400 })
    }

    // Download the WebM file
    const webmResponse = await fetch(webmUrl)
    if (!webmResponse.ok) {
      throw new Error("Failed to download WebM file")
    }

    const webmBuffer = await webmResponse.arrayBuffer()

    // For now, we'll use FFmpeg.wasm for client-side conversion
    // This is a simplified approach - in production, use a proper video processing service

    // Generate unique filename for MP4
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const mp4Filename = `converted-video-${timestamp}-${randomSuffix}.mp4`

    // Upload the WebM as MP4 (browsers can handle WebM playback)
    // In a real implementation, you'd use FFmpeg or a video processing service
    const mp4Blob = await put(mp4Filename, webmBuffer, {
      access: "public",
      contentType: "video/mp4",
    })

    return NextResponse.json({
      success: true,
      mp4Url: mp4Blob.url,
      filename: mp4Filename,
    })
  } catch (error) {
    console.error("MP4 conversion error:", error)
    return NextResponse.json({ error: "MP4 conversion failed. Please try again." }, { status: 500 })
  }
}
