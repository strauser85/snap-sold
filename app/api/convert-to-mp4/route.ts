import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { webmUrl } = await request.json()

    if (!webmUrl) {
      return NextResponse.json({ error: "No WebM URL provided" }, { status: 400 })
    }

    // Check if Fal API key exists
    if (!process.env.FAL_KEY) {
      console.error("FAL_KEY not found in environment variables")
      return NextResponse.json({ error: "Video conversion service not configured" }, { status: 500 })
    }

    console.log("Converting WebM to MP4:", webmUrl)

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
        video_codec: "h264",
        audio_codec: "aac",
        resolution: "1080x1920",
        frame_rate: 30,
        bitrate: "5000k",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Fal conversion error:", response.status, errorText)
      return NextResponse.json({ error: "Video conversion failed" }, { status: response.status })
    }

    const result = await response.json()

    if (!result.video_url) {
      return NextResponse.json({ error: "No converted video URL returned" }, { status: 500 })
    }

    return NextResponse.json({
      mp4Url: result.video_url,
      originalUrl: webmUrl,
      format: "mp4",
      codec: "h264/aac",
      resolution: "1080x1920",
      frameRate: 30,
    })
  } catch (error) {
    console.error("MP4 conversion error:", error)
    return NextResponse.json({ error: "Video conversion failed" }, { status: 500 })
  }
}
