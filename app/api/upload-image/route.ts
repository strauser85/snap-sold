import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  // Explicitly check for the Blob token
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is not set in environment variables.")
    return NextResponse.json(
      {
        error:
          "Server configuration error: Blob storage token is missing. Please ensure Vercel Blob integration is set up.",
      },
      { status: 500 },
    )
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Authenticate and authorize users before generating the token.
        // For this example, we'll allow all image types.
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          tokenPayload: JSON.stringify({ filename: pathname }), // Optional: pass metadata
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("Blob upload completed", blob, tokenPayload)
        // You can add database updates here if needed
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("Error in /api/upload-image:", error) // Log the actual error for debugging
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
