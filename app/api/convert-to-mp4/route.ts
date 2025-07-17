import { type NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/serverless-client"

export async function POST(request: NextRequest) {
  try {
    const { webmUrl } = await request.json()

    if (!webmUrl) {
      return NextResponse.json({ error: "No WebM URL provided" }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL API key not configured" }, { status: 500 })
    }

    // Configure FAL client
    fal.config({
      credentials: process.env.FAL_KEY,
    })

    // Convert WebM to MP4 using FAL
    const result = await fal.subscribe("fal-ai/video-to-video", {
      input: {
        video_url: webmUrl,
        output_format: "mp4",
        codec: "h264",
        audio_codec: "aac",
        quality: "high",
        max_file_size_mb: 100,
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log("Queue update:", update)
      },
    })

    if (!result.data?.video?.url) {
      throw new Error("No MP4 URL returned from conversion")
    }

    return NextResponse.json({
      mp4Url: result.data.video.url,
      originalUrl: webmUrl,
      fileSize: result.data.video.file_size || 0,
    })
  } catch (error) {
    console.error("MP4 conversion error:", error)
    return NextResponse.json({ error: "MP4 conversion failed. Please try again." }, { status: 500 })
  }
}
