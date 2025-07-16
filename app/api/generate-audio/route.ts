import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script || typeof script !== "string" || script.trim().length === 0) {
      return NextResponse.json({ error: "Valid script is required" }, { status: 400 })
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

    console.log("🎵 Generating audio with ElevenLabs Rachel voice...")

    // Clean script for better TTS pronunciation
    const cleanScript = script
      .replace(/\$(\d+)/g, "$1 dollars") // Convert $500000 to "500000 dollars"
      .replace(/(\d+)\s*BR/gi, "$1 bedrooms")
      .replace(/(\d+)\s*BA/gi, "$1 bathrooms")
      .replace(/(\d+)\s*sqft/gi, "$1 square feet")
      .replace(/\b(\d+),(\d+)\b/g, "$1$2") // Remove commas from numbers for TTS
      .replace(/\s+/g, " ") // Clean up multiple spaces
      .trim()

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
          style: 0.3,
          use_speaker_boost: true,
        },
        output_format: "mp3_44100_128",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs API error:", response.status, errorText)
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()
    console.log(`📊 Audio generated: ${audioBuffer.byteLength} bytes`)

    // Upload to Vercel Blob
    const { put } = await import("@vercel/blob")
    const blob = await put(`audio/rachel-${Date.now()}.mp3`, audioBuffer, {
      access: "public",
      contentType: "audio/mpeg",
    })

    // Calculate duration more accurately (rough: ~150 words per minute)
    const wordCount = cleanScript.split(/\s+/).length
    const estimatedDuration = Math.max(8, Math.min(45, (wordCount / 150) * 60))

    console.log(`✅ Audio uploaded: ${blob.url}, duration: ${estimatedDuration}s`)

    return NextResponse.json({
      audioUrl: blob.url,
      duration: estimatedDuration,
      wordCount,
      cleanScript,
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
