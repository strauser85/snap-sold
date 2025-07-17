import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { webmUrl } = await request.json()

    if (!webmUrl) {
      return NextResponse.json({ error: "WebM URL is required" }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "Fal AI API key not configured" }, { status: 500 })
    }

    // Use Fal AI for video conversion
    const response = await fetch("https://fal.run/fal-ai/video-to-video", {
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
      console.error("Fal AI conversion error:", errorData)
      return NextResponse.json(
        {
          error: "MP4 conversion failed",
          details: `Fal AI error: ${response.status}`,
        },
        { status: 500 },
      )
    }

    const result = await response.json()

    if (!result.video_url) {
      return NextResponse.json(
        {
          error: "MP4 conversion failed",
          details: "No video URL returned from Fal AI",
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      mp4Url: result.video_url,
      fileSize: result.file_size || null,
      duration: result.duration || null,
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
