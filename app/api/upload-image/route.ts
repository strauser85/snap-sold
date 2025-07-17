import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

// Increase body size limit for large image uploads
export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type - support standard real estate image formats only
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"]

    const fileExtension = file.name.toLowerCase().split(".").pop()
    const isValidType = allowedTypes.includes(file.type)
    const isValidExtension = allowedExtensions.includes(`.${fileExtension}`)

    if (!isValidType || !isValidExtension) {
      return NextResponse.json(
        {
          error: `Unsupported file format. Please use JPG, PNG, or WebP images only.`,
          fileName: file.name,
          fileType: file.type,
        },
        { status: 400 },
      )
    }

    // Validate file size (10MB max per image after compression)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      const fileSizeMB = Math.round((file.size / 1024 / 1024) * 10) / 10
      return NextResponse.json(
        {
          error: `File too large (${fileSizeMB}MB). Maximum size is 10MB per image.`,
          fileName: file.name,
          fileSize: fileSizeMB,
        },
        { status: 400 },
      )
    }

    // Generate unique filename with timestamp and random suffix
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const filename = `property-${timestamp}-${randomSuffix}-${cleanFileName}`

    // Direct streaming upload to Vercel Blob with public access
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    })

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: filename,
      size: file.size,
      type: file.type,
      originalName: file.name,
    })
  } catch (error) {
    console.error("Upload error:", error)

    // Return specific error messages for different failure types
    if (error instanceof Error) {
      if (error.message.includes("413") || error.message.includes("Content Too Large")) {
        return NextResponse.json(
          {
            error: "File size exceeds server limits. Please compress images before uploading.",
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
