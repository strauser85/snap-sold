import { type NextRequest, NextResponse } from "next/server"
import * as fal from "@fal-ai/serverless-client"

// Configure Fal AI
fal.config({
  credentials: process.env.FAL_KEY,
})

interface SlideshowRequest {
  imageUrls: string[]
  audioUrl?: string
  duration: number
  title: string
}

// Alternative slideshow creation using video editing approach
export async function POST(request: NextRequest) {
  try {
    const { imageUrls, audioUrl, duration, title }: SlideshowRequest = await request.json()

    console.log(`Creating slideshow: ${imageUrls.length} images, ${duration}s duration`)

    // Try to create a slideshow using video editing service
    try {
      const result = await fal.subscribe("fal-ai/video-editor", {
        input: {
          images: imageUrls,
          duration_per_image: Math.max(3, Math.floor(duration / imageUrls.length)),
          total_duration: duration,
          aspect_ratio: "9:16",
          transition_type: "fade",
          audio_url: audioUrl,
          title_text: title,
        },
      })

      if (result.video_url) {
        return NextResponse.json({
          success: true,
          videoUrl: result.video_url,
          method: "video-editor",
        })
      }
    } catch (error) {
      console.error("Video editor failed:", error)
    }

    // Fallback: Create using image sequence
    try {
      const result = await fal.subscribe("fal-ai/image-sequence-to-video", {
        input: {
          image_urls: imageUrls,
          fps: 1 / Math.max(3, Math.floor(duration / imageUrls.length)), // 1 frame per duration
          output_format: "mp4",
          width: 576,
          height: 1024,
        },
      })

      if (result.video_url) {
        return NextResponse.json({
          success: true,
          videoUrl: result.video_url,
          method: "image-sequence",
        })
      }
    } catch (error) {
      console.error("Image sequence failed:", error)
    }

    return NextResponse.json({ error: "Slideshow creation failed" }, { status: 500 })
  } catch (error) {
    console.error("Slideshow API error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
