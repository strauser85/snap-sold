import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Please upload JPG, PNG, or WebP images." }, { status: 400 })
    }

    // Check file size (20MB max before compression)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Please use images under 20MB." }, { status: 413 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split(".").pop() || "jpg"
    const filename = `image-${timestamp}-${randomSuffix}.${extension}`

    // Convert File to ArrayBuffer to ensure proper content-length header
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload to Vercel Blob with explicit headers
    const blob = await put(filename, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    })

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: filename,
      size: buffer.length,
      type: file.type,
    })
  } catch (error) {
    console.error("Upload error:", error)

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("413") || error.message.includes("too large")) {
        return NextResponse.json(
          { error: "File too large. Please compress your image or use a smaller file." },
          { status: 413 },
        )
      }
      if (error.message.includes("content-length")) {
        return NextResponse.json(
          { error: "Upload failed due to content-length issue. Please try again." },
          { status: 400 },
        )
      }
      if (error.message.includes("timeout")) {
        return NextResponse.json({ error: "Upload timeout. Please try again with a smaller file." }, { status: 408 })
      }
    }

    return NextResponse.json(
      {
        error: "Upload failed. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
