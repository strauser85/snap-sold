import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { Buffer } from "buffer"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    console.log("🟡 Upload route hit")

    const formData = await request.formData()
    const file = formData.get("file") as File

    console.log("📄 Received file:", file?.name, file?.type, file?.size)

    if (!file) {
      console.error("❌ No file provided")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      console.error("❌ Invalid file type:", file.type)
      return NextResponse.json(
        { error: "Invalid file type. Please upload JPG, PNG, or WebP images." },
        { status: 400 }
      )
    }

    if (file.size > 100 * 1024 * 1024) {
      console.error("❌ File too large:", file.size)
      return NextResponse.json(
        { error: "File too large. Please use images under 100MB." },
        { status: 413 }
      )
    }

    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split(".").pop() || "jpg"
    const filename = `image-${timestamp}-${randomSuffix}.${extension}`

    console.log("📦 Converting file to buffer...")
    const buffer = Buffer.from(await file.arrayBuffer())

    console.log("📤 Uploading to Vercel Blob:", filename)
    const blob = await put(filename, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    })

    console.log("✅ Upload successful:", blob.url)

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename,
      size: buffer.length,
      type: file.type,
    })
  } catch (error) {
    console.error("🔥 Upload error:", error)

    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    )
  }
}