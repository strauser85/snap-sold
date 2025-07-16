import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json({ error: "Script is required" }, { status: 400 })
    }

    console.log("🎵 Generating audio for script:", script.substring(0, 100) + "...")

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

    // Generate audio using ElevenLabs
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
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ ElevenLabs API error:", errorText)
      return NextResponse.json({ error: "Audio generation failed", details: errorText }, { status: response.status })
    }

    // Get audio data
    const audioBuffer = await response.arrayBuffer()
    console.log("✅ Audio generated, size:", audioBuffer.byteLength)

    // Upload to Vercel Blob
    const audioBlob = await put(`audio-${Date.now()}.mp3`, audioBuffer, {
      access: "public",
      contentType: "audio/mpeg",
    })

    console.log("✅ Audio uploaded to blob:", audioBlob.url)

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = script.split(" ").length
    const estimatedDuration = Math.max(5, (wordCount / 150) * 60) // At least 5 seconds

    return NextResponse.json({
      audioUrl: audioBlob.url,
      duration: estimatedDuration,
      wordCount,
    })
  } catch (error) {
    console.error("❌ Audio generation error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate audio",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
