import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json({ error: "No script provided" }, { status: 400 })
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

    console.log("🎵 Generating audio with ElevenLabs...")

    // Use Rachel voice (21m00Tcm4TlvDq8ikWAM)
    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs error:", errorText)
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    // Get audio buffer
    const audioBuffer = await response.arrayBuffer()

    // Upload to Vercel Blob
    const { put } = await import("@vercel/blob")
    const blob = await put(`audio/voice-${Date.now()}.mp3`, audioBuffer, {
      access: "public",
      contentType: "audio/mpeg",
    })

    // Calculate duration (estimate: ~150 words per minute, ~5 chars per word)
    const estimatedDuration = Math.max(10, Math.min(60, (script.length / 750) * 60))

    console.log(`✅ Audio generated: ${blob.url}, estimated duration: ${estimatedDuration}s`)

    return NextResponse.json({
      audioUrl: blob.url,
      duration: estimatedDuration,
    })
  } catch (error) {
    console.error("Audio generation error:", error)
    return NextResponse.json(
      {
        error: "Audio generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
