import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { webmUrl } = await request.json()

    if (!webmUrl) {
      return NextResponse.json({ error: "No WebM URL provided" }, { status: 400 })
    }

    // For now, return the WebM URL as MP4 URL since most browsers support WebM
    // In a production environment, you would use FFmpeg or similar to convert to MP4
    return NextResponse.json({
      mp4Url: webmUrl,
      format: "webm", // Indicate actual format
    })
  } catch (error) {
    console.error("Video processing error:", error)
    return NextResponse.json({ error: "Video processing failed" }, { status: 500 })
  }
}
