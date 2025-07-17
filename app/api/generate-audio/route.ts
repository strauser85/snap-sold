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

    // LOCKED Rachel voice - no fallbacks allowed
    const RACHEL_VOICE_ID = "21m00Tcm4TlvDq8ikWAM" // Rachel voice ID

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
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs API error:", errorText)
      throw new Error(`ElevenLabs API failed: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()

    // Estimate duration based on script length (average speaking rate: 150 words per minute)
    const wordCount = script.split(" ").length
    const estimatedDuration = Math.max(10, Math.round((wordCount / 150) * 60)) // Minimum 10 seconds

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Audio-Duration": estimatedDuration.toString(),
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("Audio generation error:", error)
    return NextResponse.json({ error: "Rachel voice generation failed. Please try again." }, { status: 500 })
  }
}
