import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json({ error: "No script provided" }, { status: 400 })
    }

    // Use ElevenLabs API
    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB", {
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
          similarity_boost: 0.5,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()

    // Upload audio to blob storage
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" })
    const formData = new FormData()
    formData.append("file", audioBlob, "audio.mp3")

    const uploadResponse = await fetch(`${request.nextUrl.origin}/api/upload-image`, {
      method: "POST",
      body: formData,
    })

    if (!uploadResponse.ok) {
      throw new Error("Audio upload failed")
    }

    const { url: audioUrl } = await uploadResponse.json()

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = script.split(" ").length
    const estimatedDuration = Math.max(10, (wordCount / 150) * 60)

    return NextResponse.json({
      audioUrl,
      duration: estimatedDuration,
    })
  } catch (error) {
    console.error("Audio generation error:", error)
    return NextResponse.json(
      { error: "Audio generation failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
