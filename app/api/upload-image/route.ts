import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("Upload request received")

    // Check environment variable
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("BLOB_READ_WRITE_TOKEN missing")
      return NextResponse.json({ error: "Blob token not configured" }, { status: 500 })
    }

    // Get the form data
    const formData = await request.formData()
    console.log("FormData parsed successfully")

    // Get the file
    const file = formData.get("file") as File
    if (!file) {
      console.error("No file in FormData")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log(`File received: ${file.name}, size: ${file.size}, type: ${file.type}`)

    // Validate file
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      return NextResponse.json({ error: "File too large" }, { status: 400 })
    }

    // Create unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2)
    const extension = file.name.split(".").pop() || "jpg"
    const filename = `property-${timestamp}-${random}.${extension}`

    console.log(`Uploading as: ${filename}`)

    // Convert to buffer and upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log(`Buffer created, size: ${buffer.length}`)

    const blob = await put(filename, buffer, {
      access: "public",
      contentType: file.type,
    })

    console.log(`Upload successful: ${blob.url}`)

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: filename,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      {
        error: "Upload failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
