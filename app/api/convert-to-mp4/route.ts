import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { webmUrl } = await request.json()

    if (!webmUrl) {
      return NextResponse.json({ error: "WebM URL is required" }, { status: 400 })
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
      const errorText = await response.text()
      console.error("Fal AI conversion error:", errorText)
      return NextResponse.json(
        {
          error: "MP4 conversion failed",
          details: `Fal AI returned ${response.status}`,
        },
        { status: 500 },
      )
    }

    const result = await response.json()

    if (!result.video_url) {
      throw new Error("No MP4 URL returned from conversion")
    }

    return NextResponse.json({ mp4Url: result.video_url })
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
