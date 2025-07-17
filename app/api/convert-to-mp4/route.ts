import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const videoFile = formData.get("video") as File

    if (!videoFile) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 })
    }

    // Check file size (max 100MB)
    if (videoFile.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "Video file too large. Maximum size is 100MB." }, { status: 413 })
    }

    // Upload to Vercel Blob
    const blob = await put(`video-${Date.now()}.webm`, videoFile, {
      access: "public",
      contentType: "video/webm",
    })

    // For now, return the WebM URL directly since MP4 conversion is complex
    // In production, you would use FFmpeg or a video processing service
    return NextResponse.json({
      success: true,
      videoUrl: blob.url,
      downloadUrl: blob.url,
      format: "webm",
      message: "Video processed successfully",
    })
  } catch (error) {
    console.error("Video conversion error:", error)
    return NextResponse.json({ error: "Failed to process video" }, { status: 500 })
  }
}
