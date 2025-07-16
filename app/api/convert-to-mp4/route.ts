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

    if (!process.env.FAL_KEY) {
      console.error("❌ FAL_KEY not configured")
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 })
    }

    // Convert File to ArrayBuffer then to Uint8Array
    const arrayBuffer = await webmFile.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Convert to base64
    let binary = ""
    const len = uint8Array.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64Data = btoa(binary)

    console.log("📦 Base64 data length:", base64Data.length)

    // Use Fal AI FFmpeg for conversion
    const response = await fetch("https://fal.run/fal-ai/ffmpeg", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input_data: base64Data,
        input_format: "webm",
        output_format: "mp4",
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
    console.log("✅ Fal AI conversion result keys:", Object.keys(result))

    // Check for different possible response formats
    const outputUrl = result.output_url || result.url || result.output_data || result.data

    if (!outputUrl) {
      console.error("❌ No output URL in result:", result)
      return NextResponse.json({ error: "No output URL from conversion" }, { status: 500 })
    }

    console.log("✅ MP4 conversion successful:", outputUrl)

    return NextResponse.json({
      success: true,
      mp4Url: outputUrl,
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
