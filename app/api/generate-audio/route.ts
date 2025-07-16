import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json({ error: "Script is required" }, { status: 400 })
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

    console.log("🎵 Generating audio with ElevenLabs...")

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs API error:", response.status, errorText)
      return NextResponse.json({ error: "Audio generation failed" }, { status: 500 })
    }

    const audioBuffer = await response.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" })

    // Upload to Vercel Blob
    const { put } = await import("@vercel/blob")
    const blob = await put(`audio-${Date.now()}.mp3`, audioBlob, {
      access: "public",
    })

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = script.split(" ").length
    const estimatedDuration = Math.max(10, (wordCount / 150) * 60)

    console.log("✅ Audio generated successfully")

    return NextResponse.json({
      audioUrl: blob.url,
      duration: estimatedDuration,
    })
  } catch (error) {
    console.error("Audio generation error:", error)
    return NextResponse.json(
      {
        error: "Audio generation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
