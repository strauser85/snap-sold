import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 })
    }

    console.log("📤 Uploading image to Vercel Blob...")

    // Upload to Vercel Blob
    const blob = await put(`property-${Date.now()}-${file.name}`, file, {
      access: "public",
    })

    console.log("✅ Image uploaded successfully:", blob.url)

    return NextResponse.json({
      url: blob.url,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error("Image upload error:", error)
    return NextResponse.json(
      {
        error: "Image upload failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
