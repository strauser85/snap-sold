import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { webmUrl } = await request.json()

    if (!webmUrl) {
      return NextResponse.json({ error: "No WebM URL provided" }, { status: 400 })
    }

    // Use Fal AI for WebM to MP4 conversion with H.264/AAC encoding
    const response = await fetch("https://fal.run/fal-ai/video-converter", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_url: webmUrl,
        output_format: "mp4",
        video_codec: "h264",
        audio_codec: "aac",
        resolution: "1080x1920", // Vertical TikTok format
        frame_rate: 30,
        video_bitrate: "5M", // 5 Mbps for high quality
        audio_bitrate: "128k",
        optimize_for_mobile: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Fal AI conversion error:", response.status, errorText)
      throw new Error(`MP4 conversion failed: ${response.status}`)
    }

    const result = await response.json()

    if (!result.video_url) {
      throw new Error("No MP4 URL returned from conversion service")
    }

    return NextResponse.json({
      mp4Url: result.video_url,
      format: "mp4",
      codec: "h264/aac",
      resolution: "1080x1920",
      frameRate: 30,
    })
  } catch (error) {
    console.error("MP4 conversion error:", error)
    return NextResponse.json({ error: "MP4 conversion failed. Please try again." }, { status: 500 })
  }
}
