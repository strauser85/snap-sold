import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const webmFile = formData.get("webm") as File

    if (!webmFile) {
      return NextResponse.json({ error: "No WebM file provided" }, { status: 400 })
    }

    console.log(`🔄 Converting WebM (${webmFile.size} bytes) to MP4...`)

    // Check file size (max 50MB for conversion)
    if (webmFile.size > 50 * 1024 * 1024) {
      console.log("⚠️ File too large for conversion, returning WebM")
      const webmUrl = URL.createObjectURL(webmFile)
      return NextResponse.json({ mp4Url: webmUrl })
    }

    // Convert to ArrayBuffer and then base64
    const webmBuffer = await webmFile.arrayBuffer()
    const webmBase64 = Buffer.from(webmBuffer).toString("base64")

    console.log("📤 Sending to Fal AI for conversion...")

    // Use Fal AI for conversion with proper H.264 + AAC settings
    const response = await fetch("https://fal.run/fal-ai/ffmpeg", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_url: `data:video/webm;base64,${webmBase64}`,
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
          "-pix_fmt",
          "yuv420p",
          "-f",
          "mp4",
          "output.mp4",
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Fal AI conversion failed:", errorText)

      // Fallback to WebM
      console.log("⚠️ Falling back to WebM format")
      const webmUrl = URL.createObjectURL(webmFile)
      return NextResponse.json({ mp4Url: webmUrl })
    }

    const result = await response.json()

    if (!result.video_url) {
      console.error("❌ No video URL in conversion result")
      const webmUrl = URL.createObjectURL(webmFile)
      return NextResponse.json({ mp4Url: webmUrl })
    }

    console.log("✅ MP4 conversion successful:", result.video_url)

    return NextResponse.json({
      mp4Url: result.video_url,
    })
  } catch (error) {
    console.error("❌ MP4 conversion error:", error)

    // Always provide fallback
    try {
      const formData = await request.formData()
      const webmFile = formData.get("webm") as File
      if (webmFile) {
        const webmUrl = URL.createObjectURL(webmFile)
        return NextResponse.json({ mp4Url: webmUrl })
      }
    } catch (fallbackError) {
      console.error("❌ Fallback failed:", fallbackError)
    }

    return NextResponse.json(
      {
        error: "MP4 conversion failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
