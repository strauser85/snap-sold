import { type NextRequest, NextResponse } from "next/server"

// API route to handle blob CORS issues
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const blobUrl = searchParams.get("url")

    if (!blobUrl) {
      return NextResponse.json({ error: "No blob URL provided" }, { status: 400 })
    }

    // Fetch the blob with proper headers
    const response = await fetch(blobUrl, {
      headers: {
        Range: "bytes=0-", // Proper range header
      },
    })

    if (!response.ok) {
      throw new Error(`Blob fetch failed: ${response.status}`)
    }

    const blob = await response.blob()

    // Return with proper headers to prevent range issues
    return new NextResponse(blob, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Content-Length": blob.size.toString(),
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type",
        "Cache-Control": "public, max-age=31536000",
      },
    })
  } catch (error) {
    console.error("Blob CORS fix error:", error)
    return NextResponse.json(
      {
        error: "Failed to fix blob CORS",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
    },
  })
}
