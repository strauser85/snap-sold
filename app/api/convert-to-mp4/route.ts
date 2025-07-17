import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

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

    // Check file size (increased to 200MB)
    if (webmBuffer.byteLength > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large for conversion" }, { status: 413 })
    }

    // Use Fal AI for video conversion
    const fal = await import("@fal-ai/serverless-client")

    fal.config({
      credentials: process.env.FAL_KEY!,
    })

    // Upload WebM to temporary storage for Fal AI
    const webmBlob = new Blob([webmBuffer], { type: "video/webm" })
    const tempUpload = await put(`temp-${Date.now()}.webm`, webmBlob, {
      access: "public",
    })

    // Convert using Fal AI
    const result = await fal.subscribe("fal-ai/video-converter", {
      input: {
        video_url: tempUpload.url,
        output_format: "mp4",
        codec: "h264",
        audio_codec: "aac",
        crf: 26,
        preset: "fast",
        max_bitrate: "2M",
      },
    })

    if (!result.data?.video_url) {
      throw new Error("Conversion failed - no output URL")
    }

    // Download converted MP4
    const mp4Response = await fetch(result.data.video_url)
    if (!mp4Response.ok) {
      throw new Error("Failed to download converted MP4")
    }

    const mp4Buffer = await mp4Response.arrayBuffer()

    // Upload final MP4 to blob storage
    const mp4Blob = new Blob([mp4Buffer], { type: "video/mp4" })
    const finalUpload = await put(`property-video-${Date.now()}.mp4`, mp4Blob, {
      access: "public",
    })

    return NextResponse.json({
      mp4Url: finalUpload.url,
      originalSize: webmBuffer.byteLength,
      convertedSize: mp4Buffer.byteLength,
      compressionRatio: (((webmBuffer.byteLength - mp4Buffer.byteLength) / webmBuffer.byteLength) * 100).toFixed(1),
    })
  } catch (error) {
    console.error("MP4 conversion error:", error)
    return NextResponse.json(
      {
        error: "MP4 conversion failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
