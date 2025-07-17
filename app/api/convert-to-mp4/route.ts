import { type NextRequest, NextResponse } from "next/server"
import * as fal from "@fal-ai/serverless-client"

export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json()

    if (!videoUrl) {
      return NextResponse.json({ error: "Video URL is required" }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "Fal API key not configured" }, { status: 500 })
    }

    fal.config({
      credentials: process.env.FAL_KEY,
    })

    // Use Fal AI for video conversion
    const result = await fal.subscribe("fal-ai/video-to-video", {
      input: {
        video_url: videoUrl,
        output_format: "mp4",
        quality: "high",
        max_file_size_mb: 100,
      },
    })

    if (!result.data?.video?.url) {
      throw new Error("No converted video URL returned")
    }

    return NextResponse.json({
      mp4Url: result.data.video.url,
      fileSize: result.data.video.file_size || 0,
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
