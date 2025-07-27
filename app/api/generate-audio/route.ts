import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

// LOCKED Rachel voice ID - never change this
const RACHEL_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json({ error: "No script provided" }, { status: 400 })
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

    // Clean script for better TTS pronunciation
    const cleanScript = script.replace(/\s+/g, " ").trim()

    console.log(`🎤 Generating Rachel voiceover for: "${cleanScript.substring(0, 100)}..."`)

    // Generate audio using LOCKED Rachel voice
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${RACHEL_VOICE_ID}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: cleanScript,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs API error:", response.status, errorText)

      let errorMessage = "Failed to generate Rachel's voiceover"
      if (response.status === 401) {
        errorMessage = "Invalid ElevenLabs API key"
      } else if (response.status === 429) {
        errorMessage = "ElevenLabs rate limit exceeded. Please try again in a moment."
      } else if (response.status === 402) {
        errorMessage = "ElevenLabs quota exceeded. Please check your account."
      }

      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    const audioBuffer = await response.arrayBuffer()

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = cleanScript.split(" ").length
    const estimatedDuration = Math.max(10, Math.round((wordCount / 150) * 60))

    console.log(`✅ Rachel voiceover generated: ${audioBuffer.byteLength} bytes, ~${estimatedDuration}s`)

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Audio-Duration": estimatedDuration.toString(),
        "X-Voice-Used": "Rachel",
      },
    })
  } catch (error) {
    console.error("Audio generation error:", error)
    return NextResponse.json(
      {
        error: "Rachel's voiceover generation failed. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
