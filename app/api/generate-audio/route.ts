import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json({ error: "No script provided" }, { status: 400 })
    }

    // LOCKED Rachel voice - no fallbacks allowed
    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
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
      throw new Error(`Rachel voice generation failed: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()

    // Estimate duration based on script length (average 150 words per minute)
    const wordCount = script.split(" ").length
    const estimatedDuration = Math.max(20, Math.min(45, (wordCount / 150) * 60))

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Audio-Duration": estimatedDuration.toString(),
      },
    })
  } catch (error) {
    console.error("Audio generation error:", error)
    return NextResponse.json({ error: "Rachel voice generation failed. Please try again." }, { status: 500 })
  }
}
