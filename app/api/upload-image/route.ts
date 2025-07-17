import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

// Increase body size limit for large video uploads (WebM files can be 50MB+)
export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Different size limits for different file types
    const isVideo = file.type.includes("video") || file.name.includes(".webm")
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024 // 100MB for video, 10MB for images

    // Validate file type - support images and video files
    const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    const allowedVideoTypes = ["video/webm", "video/mp4", "application/octet-stream"]
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes]

    const isValidType = allowedTypes.includes(file.type) || file.name.endsWith(".webm")

    if (!isValidType && !isVideo) {
      return NextResponse.json(
        {
          error: `Unsupported file format. Please use JPG, PNG, WebP images or WebM video files.`,
          fileName: file.name,
          fileType: file.type,
        },
        { status: 400 },
      )
    }

    // Validate file size with different limits for video vs images
    if (file.size > maxSize) {
      const fileSizeMB = Math.round((file.size / 1024 / 1024) * 10) / 10
      const maxSizeMB = Math.round((maxSize / 1024 / 1024) * 10) / 10
      return NextResponse.json(
        {
          error: `File too large (${fileSizeMB}MB). Maximum size is ${maxSizeMB}MB for ${isVideo ? "video" : "image"} files.`,
          fileName: file.name,
          fileSize: fileSizeMB,
        },
        { status: 413 },
      )
    }

    // Generate unique filename with timestamp and random suffix
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const filename = `${isVideo ? "video" : "property"}-${timestamp}-${randomSuffix}-${cleanFileName}`

    // Direct streaming upload to Vercel Blob with public access
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type || (isVideo ? "video/webm" : "application/octet-stream"),
    })

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: filename,
      size: file.size,
      type: file.type,
      originalName: file.name,
      isVideo: isVideo,
    })
  } catch (error) {
    console.error("Upload error:", error)

    // Return specific error messages for different failure types
    if (error instanceof Error) {
      if (
        error.message.includes("413") ||
        error.message.includes("Content Too Large") ||
        error.message.includes("PayloadTooLargeError")
      ) {
        return NextResponse.json(
          {
            error: "File size exceeds server limits. Please use smaller files or try again.",
          },
          { status: 413 },
        )
      }
      if (error.message.includes("blob") || error.message.includes("storage")) {
        return NextResponse.json(
          {
            error: "Storage service temporarily unavailable. Please try again in a moment.",
          },
          { status: 503 },
        )
      }
      if (error.message.includes("network") || error.message.includes("timeout")) {
        return NextResponse.json(
          {
            error: "Network timeout. Please check your connection and try again.",
          },
          { status: 502 },
        )
      }
    }

    return NextResponse.json(
      {
        error: "Upload failed. Please try again or contact support if the problem persists.",
      },
      { status: 500 },
    )
  }
}
