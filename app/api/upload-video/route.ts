import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

// Increase body size limit for video uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "100mb",
    },
  },
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["video/webm", "video/mp4"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid video type. Please upload WebM or MP4.",
        },
        { status: 400 },
      )
    }

    // Check file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: "Video file too large. Maximum size is 100MB.",
        },
        { status: 413 },
      )
    }

    console.log(`📹 Uploading video: ${file.size} bytes, type: ${file.type}`)

    // Generate unique filename
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const filename = `video-${timestamp}-${randomSuffix}.webm`

    // Convert File to ArrayBuffer for proper streaming and content-length
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    console.log(`📦 Processing video buffer: ${buffer.length} bytes`)

    // Upload to Vercel Blob with streaming support
    const blob = await put(filename, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    })

    console.log(`✅ Video uploaded successfully: ${blob.url}`)

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: filename,
      size: buffer.length,
      type: file.type,
    })
  } catch (error) {
    console.error("Video upload error:", error)

    // Always return valid JSON, even for errors
    if (error instanceof Error) {
      if (error.message.includes("413") || error.message.includes("too large") || error.message.includes("Too Large")) {
        return NextResponse.json(
          {
            error: "Video file too large. Please try a shorter video or lower quality.",
          },
          { status: 413 },
        )
      }
      if (error.message.includes("timeout")) {
        return NextResponse.json(
          {
            error: "Video upload timeout. Please try again with a smaller file.",
          },
          { status: 408 },
        )
      }
      if (error.message.includes("content-length")) {
        return NextResponse.json(
          {
            error: "Video upload failed due to size issue. Please try again.",
          },
          { status: 400 },
        )
      }
    }

    return NextResponse.json(
      {
        error: "Video upload failed. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
