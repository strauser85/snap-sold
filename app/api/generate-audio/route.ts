import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

interface ElevenLabsResponse {
  audio_base64?: string
  alignment?: {
    characters: string[]
    character_start_times_seconds: number[]
    character_end_times_seconds: number[]
  }
}

function sanitizeScriptForElevenLabs(script: string): string {
  console.log("🧹 SANITIZING SCRIPT FOR ELEVENLABS...")

  let sanitized = script
    // Remove ALL emoji / pictographs
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    // Clean up multiple spaces and line breaks
    .replace(/\s+/g, " ")
    .replace(/\n+/g, ". ")
    // Remove problematic punctuation combinations
    .replace(/[!]{2,}/g, "!")
    .replace(/[?]{2,}/g, "?")
    .replace(/[.]{2,}/g, ".")
    // Ensure proper sentence endings
    .replace(/([a-zA-Z0-9])\s*([A-Z])/g, "$1. $2")
    .trim()

  // Ensure it ends with proper punctuation
  if (sanitized && !sanitized.match(/[.!?]$/)) {
    sanitized += "."
  }

  console.log(`✅ Script sanitized: ${script.length} → ${sanitized.length} chars`)
  return sanitized
}

function calculateOptimalDuration(script: string): number {
  const wordCount = script.split(/\s+/).length
  const baseReadingTime = (wordCount / 180) * 60 // 180 WPM for natural speech
  const finalDuration = Math.min(Math.max(baseReadingTime, 10), 45) // 10-45 second range
  console.log(`📊 Duration: ${finalDuration.toFixed(1)}s for ${wordCount} words`)
  return finalDuration
}

export async function POST(request: NextRequest) {
  console.log("🎤 STARTING AUDIO GENERATION WITH RACHEL VOICE")

  try {
    const { script } = await request.json()

    if (!script || typeof script !== "string" || script.trim().length < 10) {
      throw new Error("Script is required and must be at least 10 characters")
    }

    const sanitizedScript = sanitizeScriptForElevenLabs(script)
    const duration = calculateOptimalDuration(sanitizedScript)

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsApiKey) {
      throw new Error("ElevenLabs API key not configured")
    }

    console.log("🎤 GENERATING AUDIO WITH RACHEL VOICE...")

    const elevenLabsPayload = {
      text: sanitizedScript,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.75,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true,
      },
      output_format: "mp3_44100_128",
      apply_text_normalization: "auto",
    }

    let audioResponse: Response
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      attempts++
      console.log(`🎤 Audio generation attempt ${attempts}/${maxAttempts}`)

      try {
        audioResponse = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsApiKey,
          },
          body: JSON.stringify(elevenLabsPayload),
        })

        if (audioResponse.ok) {
          console.log(`✅ Audio generation successful on attempt ${attempts}`)
          break
        } else {
          const errorText = await audioResponse.text()
          console.error(`❌ ElevenLabs API error (attempt ${attempts}):`, errorText)

          if (attempts === maxAttempts) {
            throw new Error(`ElevenLabs API failed after ${maxAttempts} attempts: ${errorText}`)
          }

          await new Promise((resolve) => setTimeout(resolve, 1000 * attempts))
        }
      } catch (fetchError) {
        console.error(`❌ Network error on attempt ${attempts}:`, fetchError)

        if (attempts === maxAttempts) {
          throw new Error(`Network error after ${maxAttempts} attempts: ${fetchError}`)
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts))
      }
    }

    console.log("🎵 PROCESSING AUDIO RESPONSE...")

    const audioBuffer = await audioResponse!.arrayBuffer()
    console.log(`📊 Audio buffer size: ${audioBuffer.byteLength} bytes`)

    if (audioBuffer.byteLength === 0) {
      throw new Error("Received empty audio buffer")
    }

    // Validate audio buffer (check for MP3 header)
    const uint8Array = new Uint8Array(audioBuffer)
    const isValidMP3 = uint8Array[0] === 0xff && (uint8Array[1] & 0xe0) === 0xe0

    if (!isValidMP3) {
      console.warn("⚠️ Audio buffer may not be valid MP3, but continuing...")
    } else {
      console.log("✅ Valid MP3 audio buffer confirmed")
    }

    // Convert to base64 data URL with proper MIME type
    const base64Audio = Buffer.from(audioBuffer).toString("base64")
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`

    console.log(`✅ Audio converted to data URL: ${audioUrl.length} characters`)

    const response = {
      audioUrl,
      duration,
      audioSize: audioBuffer.byteLength,
      audioFormat: "mp3",
    }

    console.log("✅ AUDIO GENERATION SUCCESSFUL")
    return NextResponse.json(response)
  } catch (error) {
    console.error("❌ AUDIO GENERATION FAILED:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        details: error instanceof Error ? error.stack : "No additional details",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
