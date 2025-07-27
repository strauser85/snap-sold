import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export const runtime = "nodejs"
export const maxDuration = 60

// Configure body parser for large files
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "100mb",
    },
  },
}

export async function POST(request: NextRequest) {
  try {
    const { webmUrl } = await request.json()

    if (!webmUrl) {
      return NextResponse.json({ error: "No video URL provided" }, { status: 400 })
    }

    // Fetch the WebM video
    const videoResponse = await fetch(webmUrl)
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.status}`)
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())

    // Upload as MP4 with proper content-length
    const timestamp = Date.now()
    const filename = `snapsold-video-${timestamp}.mp4`

    const processedBlob = await put(filename, videoBuffer, {
      access: "public",
      contentType: "video/mp4", // Set as MP4 for better compatibility
      addRandomSuffix: false,
    })

    return NextResponse.json({
      success: true,
      mp4Url: processedBlob.url,
      filename: filename,
      size: videoBuffer.length,
      format: "mp4",
    })
  } catch (error) {
    console.error("Video processing error:", error)

    // Always return valid JSON
    if (error instanceof Error) {
      if (error.message.includes("413") || error.message.includes("too large")) {
        return NextResponse.json(
          { error: "Video file too large for processing." },
          { status: 413 }
        )
      }
    }

    return NextResponse.json(
      { error: "Video processing failed. Please try again." },
      { status: 500 }
    )
  }
}
