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

    // Clean script for TTS
    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\$(\d+)/g, "$1 dollars")
      .trim()

    console.log("Generating audio for script:", cleanScript.substring(0, 100) + "...")

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
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
          stability: 0.7,
          similarity_boost: 0.8,
          style: 0.3,
          use_speaker_boost: true,
        },
        output_format: "mp3_44100_128",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs API error:", response.status, errorText)
      return NextResponse.json({ error: `ElevenLabs API error: ${response.status} - ${errorText}` }, { status: 500 })
    }

    const audioBlob = await response.blob()
    if (audioBlob.size === 0) {
      return NextResponse.json({ error: "Empty audio response" }, { status: 500 })
    }

    // Convert to base64
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`

    // Estimate duration
    const wordCount = cleanScript.split(" ").length
    const estimatedDuration = Math.max(15, Math.ceil((wordCount / 150) * 60))

    console.log(`Audio generated: ${audioBlob.size} bytes, ~${estimatedDuration}s`)

    return NextResponse.json({
      success: true,
      audioUrl,
      duration: estimatedDuration,
    })
  } catch (error) {
    console.error("Audio generation failed:", error)
    return NextResponse.json(
      {
        error: "Audio generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
