import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type - support standard real estate image formats
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Please use JPG, PNG, or WebP.` },
        { status: 400 },
      )
    }

    // Validate file size (10MB max per image)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large: ${Math.round(file.size / 1024 / 1024)}MB. Maximum size is 10MB.` },
        { status: 400 },
      )
    }

    // Generate unique filename with timestamp and random suffix
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const filename = `property-${timestamp}-${randomSuffix}.${fileExtension}`

    // Upload to Vercel Blob with public access
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false, // We're adding our own suffix
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
      if (error.message.includes("blob")) {
        return NextResponse.json({ error: "Storage service unavailable. Please try again." }, { status: 503 })
      }
      if (error.message.includes("network")) {
        return NextResponse.json({ error: "Network error. Please check your connection." }, { status: 502 })
      }
    }

    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 })
  }
}
