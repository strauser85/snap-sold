import { type NextRequest, NextResponse } from "next/server"

interface VideoRequest {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription?: string
  script: string
  imageUrls: string[]
}

// Generate ElevenLabs Rachel voiceover
async function generateRachelVoice(script: string): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
  try {
    console.log("🎤 Generating Rachel voiceover...")

    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured")
    }

    const apiKey = process.env.ELEVENLABS_API_KEY.trim()
    if (apiKey.length < 20) {
      throw new Error("ElevenLabs API key appears invalid")
    }

    // Clean script for TTS
    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\$(\d+)/g, "$1 dollars")
      .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
      .replace(/(\d+)\s*bed/gi, "$1 bedroom")
      .replace(/(\d+)\s*bath/gi, "$1 bathroom")
      .trim()

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: cleanScript,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.85,
          style: 0.25,
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
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

    console.log("✅ Rachel voice generated successfully")
    return { success: true, audioUrl: audioDataUrl }
  } catch (error) {
    console.error("❌ Rachel voice failed:", error)
    return { success: false, error: error instanceof Error ? error.message : "Voice generation failed" }
  }
}

// Generate TikTok captions
function generateTikTokCaptions(script: string, duration: number) {
  const cleanText = script
    .replace(/[^\w\s.,!?'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const sentences = cleanText.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const captions: Array<{ text: string; startTime: number; endTime: number }> = []

  let currentTime = 0
  const totalWords = cleanText.split(/\s+/).length
  const wordsPerSecond = totalWords / duration

  sentences.forEach((sentence) => {
    const words = sentence.trim().split(/\s+/)

    if (words.length > 4) {
      // Break into chunks of 4 words max
      for (let i = 0; i < words.length; i += 4) {
        const chunk = words.slice(i, i + 4).join(" ")
        const chunkDuration = Math.max(1.5, chunk.split(/\s+/).length / wordsPerSecond)

        captions.push({
          text: chunk.toUpperCase(),
          startTime: currentTime,
          endTime: currentTime + chunkDuration,
        })
        currentTime += chunkDuration
      }
    } else {
      const chunkDuration = Math.max(1.5, words.length / wordsPerSecond)
      captions.push({
        text: sentence.trim().toUpperCase(),
        startTime: currentTime,
        endTime: currentTime + chunkDuration,
      })
      currentTime += chunkDuration
    }
  })

  return captions
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 COMPLETE VIDEO GENERATION STARTED")

    const data: VideoRequest = await request.json()

    // Validation
    if (!data.address || !data.price || !data.script || !data.imageUrls || data.imageUrls.length === 0) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 })
    }

    console.log(`📍 Property: ${data.address}`)
    console.log(`🖼️ Images: ${data.imageUrls.length}`)
    console.log(`📝 Script: ${data.script.length} chars`)

    // Step 1: Generate Rachel voice
    const audioResult = await generateRachelVoice(data.script)
    if (!audioResult.success) {
      return NextResponse.json({ error: `Voice generation failed: ${audioResult.error}` }, { status: 500 })
    }

    // Step 2: Calculate timing
    const wordCount = data.script.split(" ").length
    const estimatedDuration = Math.max(30, Math.ceil((wordCount / 150) * 60))
    const timePerImage = Math.max(3, Math.floor(estimatedDuration / data.imageUrls.length))

    // Step 3: Generate captions
    const captions = generateTikTokCaptions(data.script, estimatedDuration)

    console.log(`📊 Video: ${estimatedDuration}s duration, ${timePerImage}s per image, ${captions.length} captions`)

    // Return everything needed for client-side video generation
    return NextResponse.json({
      success: true,
      audioUrl: audioResult.audioUrl,
      images: data.imageUrls,
      duration: estimatedDuration,
      timePerImage,
      captions,
      property: {
        address: data.address,
        price: data.price,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        sqft: data.sqft,
      },
      format: {
        width: 576,
        height: 1024,
        fps: 30,
      },
    })
  } catch (error) {
    console.error("❌ Complete video generation failed:", error)
    return NextResponse.json(
      { error: "Video generation failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
