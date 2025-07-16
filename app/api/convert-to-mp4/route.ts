import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const webmFile = formData.get("webm") as File

    if (!webmFile) {
      return NextResponse.json({ error: "WebM file is required" }, { status: 400 })
    }

    console.log("🎬 Converting WebM to MP4...")
    console.log("WebM file size:", webmFile.size)

    // Convert File to ArrayBuffer then to base64
    const arrayBuffer = await webmFile.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString("base64")
    const dataUrl = `data:video/webm;base64,${base64Data}`

    // Use Fal AI FFmpeg for conversion
    const response = await fetch("https://fal.run/fal-ai/ffmpeg", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input_url: dataUrl,
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
      console.error("❌ Fal AI FFmpeg error:", errorText)
      return NextResponse.json({ error: `FFmpeg conversion failed: ${errorText}` }, { status: 500 })
    }

    const result = await response.json()
    console.log("✅ Fal AI conversion result:", result)

    if (!result.output_url) {
      return NextResponse.json({ error: "No output URL from conversion" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mp4Url: result.output_url,
    })
  } catch (error) {
    console.error("❌ MP4 conversion error:", error)
    return NextResponse.json(
      {
        error: "MP4 conversion failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
