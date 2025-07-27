import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

// Configure body parser
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
}

// LOCKED Rachel voice ID
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

    // Generate audio using Rachel's voice with optimized settings
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${RACHEL_VOICE_ID}`, {
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
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs API error:", errorText)
      return NextResponse.json(
        { error: "Failed to generate Rachel's voiceover" },
        { status: response.status }
      )
    }

    const audioBuffer = await response.arrayBuffer()
    const duration = Math.max(script.length * 0.08, 15) // Estimate duration

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
      { error: "Rachel's voiceover generation failed. Please try again." },
      { status: 500 }
    )
  }
}
