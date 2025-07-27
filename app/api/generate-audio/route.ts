import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json(
        {
          error: "No script provided",
        },
        { status: 400 },
      )
    }

    console.log("🎤 Generating Rachel's voiceover...")

    // Generate audio using ElevenLabs with LOCKED Rachel voice
    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
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
      console.error("ElevenLabs API error:", errorText)
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()
    const duration = Math.max(script.length * 0.08, 15) // Estimate duration

    console.log(`✅ Rachel voiceover generated: ${audioBuffer.byteLength} bytes, ~${duration}s`)

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Audio-Duration": duration.toString(),
      },
    })
  } catch (error) {
    console.error("Audio generation error:", error)

    return NextResponse.json(
      {
        error: "Failed to generate Rachel's voiceover. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
