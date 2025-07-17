import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json({ error: "Script is required" }, { status: 400 })
    }

    // Clean script for better pronunciation
    const cleanedScript = script
      .replace(/\bDr\b/g, "Drive")
      .replace(/\bSt\b/g, "Street")
      .replace(/\bAve\b/g, "Avenue")
      .replace(/\bBlvd\b/g, "Boulevard")
      .replace(/\bRd\b/g, "Road")
      .replace(/\bLn\b/g, "Lane")
      .replace(/\bCt\b/g, "Court")
      .replace(/\bPkwy\b/g, "Parkway")
      .replace(/\bCir\b/g, "Circle")
      .replace(/\bTer\b/g, "Terrace")
      .replace(/\bPl\b/g, "Place")
      .replace(/\bBR\b/g, "bedroom")
      .replace(/\bBA\b/g, "bathroom")
      .replace(/\bsqft\b/gi, "square feet")
      .replace(/\bSQ FT\b/gi, "square feet")

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB", {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text: cleanedScript,
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
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" })

    // Upload audio to blob storage
    const { put } = await import("@vercel/blob")
    const blob = await put(`audio-${Date.now()}.mp3`, audioBlob, {
      access: "public",
    })

    // Get audio duration (estimate based on text length)
    const estimatedDuration = Math.max(10, Math.min(30, cleanedScript.length / 10))

    return NextResponse.json({
      audioUrl: blob.url,
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
