import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const webmFile = formData.get("webm") as File

    if (!webmFile) {
      return NextResponse.json({ error: "No WebM file provided" }, { status: 400 })
    }

    console.log("🔄 Converting WebM to MP4 with Fal AI...")

    // Convert File to ArrayBuffer
    const webmBuffer = await webmFile.arrayBuffer()
    const webmBase64 = Buffer.from(webmBuffer).toString("base64")

    // Use Fal AI for video conversion
    const response = await fetch("https://fal.run/fal-ai/ffmpeg", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_url: `data:video/webm;base64,${webmBase64}`,
        codec: "libx264",
        container: "mp4",
        video_bitrate: 2000,
        audio_bitrate: 128,
        preset: "medium",
        crf: 23,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Fal AI conversion error:", errorText)
      throw new Error(`Fal AI conversion failed: ${response.status}`)
    }

    const result = await response.json()
    console.log("✅ MP4 conversion successful")

    return NextResponse.json({
      mp4Url: result.video_url,
      success: true,
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
