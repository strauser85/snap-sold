import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json({ error: "Script is required" }, { status: 400 })
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

    // Rachel voice ID - LOCKED
    const RACHEL_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${RACHEL_VOICE_ID}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2",
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
      console.error("ElevenLabs error:", errorText)
      return NextResponse.json(
        {
          error: "Audio generation failed",
          details: `ElevenLabs API error: ${response.status}`,
        },
        { status: 500 },
      )
    }

    const audioBuffer = await response.arrayBuffer()

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = script.split(" ").length
    const estimatedDuration = Math.max(10, Math.round((wordCount / 150) * 60))

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Audio-Duration": estimatedDuration.toString(),
        "Cache-Control": "public, max-age=3600",
      },
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
