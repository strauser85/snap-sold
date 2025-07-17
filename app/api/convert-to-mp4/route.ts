import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const webmFile = formData.get("webm") as File

    if (!webmFile) {
      return NextResponse.json({ error: "No WebM file provided" }, { status: 400 })
    }

    console.log(`🔄 Converting WebM (${webmFile.size} bytes) to MP4...`)

    // Check file size (max 100MB)
    if (webmFile.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large for conversion" }, { status: 413 })
    }

    // Convert to ArrayBuffer and then base64
    const webmBuffer = await webmFile.arrayBuffer()
    const webmBase64 = Buffer.from(webmBuffer).toString("base64")
    const dataUrl = `data:video/webm;base64,${webmBase64}`

    // Use Fal AI for conversion
    const response = await fetch("https://fal.run/fal-ai/ffmpeg", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_url: dataUrl,
        ffmpeg_args: [
          "-i",
          "input.webm",
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
          "-preset",
          "medium",
          "-crf",
          "23",
          "-movflags",
          "+faststart",
          "-f",
          "mp4",
          "output.mp4",
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Fal AI conversion failed:", errorText)
      throw new Error(`Conversion failed: ${response.status}`)
    }

    const result = await response.json()

    if (!result.video_url) {
      throw new Error("No video URL in conversion result")
    }

    // Upload converted MP4 to Vercel Blob
    const mp4Response = await fetch(result.video_url)
    const mp4Buffer = await mp4Response.arrayBuffer()

    const blob = await put(`videos/property-${Date.now()}.mp4`, mp4Buffer, {
      access: "public",
      contentType: "video/mp4",
    })

    console.log("✅ MP4 conversion successful:", blob.url)

    return NextResponse.json({
      mp4Url: blob.url,
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
