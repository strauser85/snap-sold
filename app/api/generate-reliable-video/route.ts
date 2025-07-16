import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

interface PropertyData {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription: string
  script: string
  imageUrls: string[]
}

// RELIABLE audio generation with proper error handling
async function generateReliableAudio(script: string): Promise<{
  success: boolean
  audioUrl?: string
  duration?: number
  error?: string
}> {
  try {
    console.log("🎤 RELIABLE AUDIO: Starting generation...")

    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured")
    }

    // Clean script for TTS
    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\$(\d+)/g, "$1 dollars")
      .trim()

    console.log(`📝 Clean script: ${cleanScript.substring(0, 100)}...`)

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
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
    }

    const audioBlob = await response.blob()
    if (audioBlob.size === 0) {
      throw new Error("Empty audio response")
    }

    // Convert to data URL
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`

    // Estimate duration (rough calculation)
    const wordCount = cleanScript.split(" ").length
    const estimatedDuration = Math.max(15, Math.ceil((wordCount / 150) * 60))

    console.log(`✅ RELIABLE AUDIO: Generated ${audioBlob.size} bytes, ~${estimatedDuration}s`)

    return {
      success: true,
      audioUrl,
      duration: estimatedDuration,
    }
  } catch (error) {
    console.error("❌ RELIABLE AUDIO: Failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Audio generation failed",
    }
  }
}

// RELIABLE caption timing based on natural speech patterns
function generateReliableCaptions(script: string, duration: number) {
  console.log("📝 RELIABLE CAPTIONS: Generating timed captions...")

  // Split script into natural phrases
  const sentences = script
    .replace(/[^\w\s.,!?'-]/g, " ")
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim())

  const captions = []
  let currentTime = 0.5 // Start after brief pause
  const timePerSentence = (duration - 1) / sentences.length

  sentences.forEach((sentence, index) => {
    if (sentence.length > 0) {
      // Break long sentences into shorter phrases for TikTok style
      const words = sentence.split(" ")
      const phrases = []

      // Group words into 2-4 word phrases
      for (let i = 0; i < words.length; i += 3) {
        const phrase = words.slice(i, i + 3).join(" ")
        if (phrase.trim()) {
          phrases.push(phrase.trim().toUpperCase())
        }
      }

      // Distribute phrases across the sentence time
      const phraseTime = timePerSentence / phrases.length

      phrases.forEach((phrase, phraseIndex) => {
        const startTime = currentTime + phraseIndex * phraseTime
        const endTime = startTime + phraseTime - 0.1 // Small gap

        captions.push({
          text: phrase,
          startTime: Math.max(0, startTime),
          endTime: Math.min(duration, endTime),
        })
      })
    }

    currentTime += timePerSentence
  })

  console.log(`✅ RELIABLE CAPTIONS: Generated ${captions.length} caption chunks`)
  return captions
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 RELIABLE VIDEO: Starting generation...")

    const propertyData: PropertyData = await request.json()

    // Validate input
    if (!propertyData.script || !propertyData.imageUrls || propertyData.imageUrls.length === 0) {
      return NextResponse.json({ error: "Missing script or images" }, { status: 400 })
    }

    console.log(`📋 Property: ${propertyData.address}`)
    console.log(`📸 Images: ${propertyData.imageUrls.length}`)
    console.log(`📝 Script: ${propertyData.script.length} chars`)

    // Step 1: Generate reliable audio
    const audioResult = await generateReliableAudio(propertyData.script)

    if (!audioResult.success) {
      return NextResponse.json(
        {
          error: "Audio generation failed",
          details: audioResult.error,
        },
        { status: 500 },
      )
    }

    // Step 2: Generate reliable captions
    const captions = generateReliableCaptions(propertyData.script, audioResult.duration!)

    // Step 3: Calculate timing
    const timePerImage = Math.max(2, Math.floor(audioResult.duration! / propertyData.imageUrls.length))

    console.log(`📊 Timing: ${audioResult.duration}s total, ${timePerImage}s per image`)

    return NextResponse.json({
      success: true,
      audioUrl: audioResult.audioUrl,
      duration: audioResult.duration,
      captions,
      images: propertyData.imageUrls,
      timePerImage,
      property: {
        address: propertyData.address,
        price: propertyData.price,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        sqft: propertyData.sqft,
      },
      format: {
        width: 576,
        height: 1024,
        fps: 30,
      },
    })
  } catch (error) {
    console.error("❌ RELIABLE VIDEO: Generation failed:", error)
    return NextResponse.json(
      {
        error: "Video generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
