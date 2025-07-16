import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const webmFile = formData.get("webm") as File

    if (!webmFile) {
      return NextResponse.json({ error: "WebM file is required" }, { status: 400 })
    }

    // Upload WebM to blob storage first
    const webmBlob = await put(`temp-${Date.now()}.webm`, webmFile, {
      access: "public",
    })

    // Use FFmpeg via Fal to convert WebM to MP4
    const response = await fetch("https://fal.run/fal-ai/ffmpeg", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input_url: webmBlob.url,
        ffmpeg_args: [
          "-i",
          webmBlob.url,
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
          "-preset",
          "fast",
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
      return NextResponse.json({ error: `FFmpeg conversion failed: ${errorText}` }, { status: 500 })
    }

    const result = await response.json()

    if (!result.output_url) {
      return NextResponse.json({ error: "No output URL from conversion" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mp4Url: result.output_url,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "MP4 conversion failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
