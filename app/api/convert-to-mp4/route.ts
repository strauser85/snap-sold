import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { webmUrl } = await request.json()

    if (!webmUrl) {
      return NextResponse.json({ error: "No WebM URL provided" }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "Fal AI API key not configured" }, { status: 500 })
    }

    // Use Fal AI for video conversion
    const response = await fetch("https://fal.run/fal-ai/video-converter", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_url: webmUrl,
        output_format: "mp4",
        quality: "high",
        max_file_size_mb: 100,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Fal AI conversion failed: ${errorData.detail || response.statusText}`)
    }

    const result = await response.json()

    return NextResponse.json({
      mp4Url: result.video_url,
      originalSize: result.original_size_mb,
      convertedSize: result.converted_size_mb,
      duration: result.duration_seconds,
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
