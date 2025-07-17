import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { webmUrl } = await request.json()

    if (!webmUrl) {
      return NextResponse.json({ error: "No WebM URL provided" }, { status: 400 })
    }

    // Use Fal AI for video conversion
    const fal = await import("@fal-ai/serverless-client")

    const result = await fal.default.subscribe("fal-ai/video-converter", {
      input: {
        video_url: webmUrl,
        output_format: "mp4",
        codec: "h264",
        audio_codec: "aac",
        quality: "high",
        max_file_size_mb: 100,
      },
    })

    if (result.video_url) {
      return NextResponse.json({ mp4Url: result.video_url })
    } else {
      throw new Error("Conversion failed")
    }
  } catch (error) {
    console.error("MP4 conversion error:", error)
    return NextResponse.json({ error: "MP4 conversion failed" }, { status: 500 })
  }
}
