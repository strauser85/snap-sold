import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script || typeof script !== "string") {
      return NextResponse.json({ error: "Script is required" }, { status: 400 })
    }

    // Use ElevenLabs API with Rachel voice (locked)
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
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs API error:", errorText)
      return NextResponse.json(
        {
          error: "Audio generation failed",
          details: `ElevenLabs API returned ${response.status}`,
        },
        { status: 500 },
      )
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
      throw new Error("Failed to upload audio")
    }

    const { url: audioUrl } = await uploadResponse.json()

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = script.split(/\s+/).length
    const estimatedDuration = Math.max(5, (wordCount / 150) * 60)

    return NextResponse.json({
      audioUrl,
      duration: estimatedDuration,
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
