import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 })
    }

    const formData = await request.formData()
    const webmFile = formData.get("webm") as File

    if (!webmFile) {
      return NextResponse.json({ error: "No WebM file provided" }, { status: 400 })
    }

    console.log("🔄 Converting WebM to MP4 using Fal AI...")

    // Convert file to base64 data URL
    const arrayBuffer = await webmFile.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const base64String = btoa(String.fromCharCode(...uint8Array))
    const dataUrl = `data:video/webm;base64,${base64String}`

    // Use Fal AI for video conversion
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
          "fast",
          "-crf",
          "23",
          "-movflags",
          "+faststart",
          "output.mp4",
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Fal AI conversion error:", response.status, errorText)
      throw new Error(`Conversion failed: ${response.status}`)
    }

    const result = await response.json()
    console.log("✅ MP4 conversion successful")

    // The result might have different property names, check common ones
    const mp4Url = result.video_url || result.output_url || result.url || result.video

    if (!mp4Url) {
      console.error("No MP4 URL in response:", result)
      throw new Error("No MP4 URL returned from conversion")
    }

    return NextResponse.json({
      mp4Url,
      success: true,
    })
  } catch (error) {
    console.error("MP4 conversion error:", error)
    return NextResponse.json(
      {
        error: "MP4 conversion failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
