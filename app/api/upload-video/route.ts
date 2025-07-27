import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["video/webm", "video/mp4", "video/mov", "video/avi"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid video format. Please upload WebM, MP4, MOV, or AVI files.",
        },
        { status: 400 },
      )
    }

    // Validate file size - 100MB max
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: "Video file too large. Maximum size is 100MB.",
        },
        { status: 413 },
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split(".").pop() || "webm"
    const filename = `video-${timestamp}-${randomSuffix}.${extension}`

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    })

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: filename,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error("Video upload error:", error)

    if (error instanceof Error) {
      if (error.message.includes("413") || error.message.includes("too large")) {
        return NextResponse.json(
          {
            error: "Video file too large. Please use a file under 100MB.",
          },
          { status: 413 },
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
