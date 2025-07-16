import { type NextRequest, NextResponse } from "next/server"

interface AudioRequest {
  script: string
}

export async function POST(request: NextRequest) {
  try {
    const { script }: AudioRequest = await request.json()

    if (!script?.trim()) {
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
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs API error:", response.status, errorText)
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()
    console.log("✅ Audio generated, size:", audioBuffer.byteLength)

    // Upload to Vercel Blob
    const { put } = await import("@vercel/blob")
    const blob = await put(`audio-${Date.now()}.mp3`, audioBuffer, {
      access: "public",
      contentType: "audio/mpeg",
    })

    // Get audio duration (estimate based on script length)
    const wordsPerMinute = 150
    const wordCount = script.split(" ").length
    const estimatedDuration = Math.max(10, (wordCount / wordsPerMinute) * 60)

    console.log(`🎵 Audio uploaded: ${blob.url}, estimated duration: ${estimatedDuration}s`)

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
