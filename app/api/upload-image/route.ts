import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("images") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    // Limit to 30 images max
    if (files.length > 30) {
      return NextResponse.json({ error: "Maximum 30 images allowed" }, { status: 400 })
    }

    const uploadResults = []
    const errors = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        // Check file size (max 10MB per image)
        if (file.size > 10 * 1024 * 1024) {
          errors.push(`File ${i + 1}: Too large (max 10MB)`)
          uploadResults.push({ success: false, error: "File too large" })
          continue
        }

        // Check file type
        if (!file.type.startsWith("image/")) {
          errors.push(`File ${i + 1}: Not an image file`)
          uploadResults.push({ success: false, error: "Invalid file type" })
          continue
        }

        // Upload to Vercel Blob
        const blob = await put(`image-${Date.now()}-${i}.${file.name.split(".").pop()}`, file, {
          access: "public",
          contentType: file.type,
        })

        uploadResults.push({
          success: true,
          url: blob.url,
          filename: file.name,
          size: file.size,
        })
      } catch (uploadError) {
        console.error(`Upload error for file ${i + 1}:`, uploadError)
        errors.push(`File ${i + 1}: Upload failed`)
        uploadResults.push({ success: false, error: "Upload failed" })
      }
    }

    const successfulUploads = uploadResults.filter((result) => result.success)
    const imageUrls = successfulUploads.map((result) => result.url)

    return NextResponse.json({
      success: true,
      imageUrls,
      uploadResults,
      totalUploaded: successfulUploads.length,
      totalFailed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
