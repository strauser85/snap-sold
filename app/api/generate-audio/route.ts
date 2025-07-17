import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json({ error: "No script provided" }, { status: 400 })
    }

    // Check if ElevenLabs API key exists
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY not found in environment variables")
      return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

    // Clean script for better TTS - remove any remaining formatting
    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    console.log(`Generating audio for script: ${cleanScript.substring(0, 100)}...`)

    // Generate audio using Rachel voice (LOCKED - no fallbacks)
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
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
        output_format: "mp3_44100_128",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs API error:", response.status, errorText)
      return NextResponse.json({ error: "Voice generation failed" }, { status: response.status })
    }

    const audioBlob = await response.blob()

    if (audioBlob.size === 0) {
      return NextResponse.json({ error: "Empty audio file generated" }, { status: 500 })
    }

    // Calculate estimated duration (rough estimate: ~150 words per minute)
    const wordCount = cleanScript.split(" ").length
    const estimatedDuration = Math.max(10, Math.round((wordCount / 150) * 60))

    // Return audio blob with duration header
    const headers = new Headers()
    headers.set("Content-Type", "audio/mpeg")
    headers.set("X-Audio-Duration", estimatedDuration.toString())

    return new NextResponse(audioBlob, { headers })
  } catch (error) {
    console.error("Audio generation error:", error)
    return NextResponse.json({ error: "Audio generation failed" }, { status: 500 })
  }
}
