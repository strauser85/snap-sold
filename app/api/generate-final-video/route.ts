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

// Generate ElevenLabs voiceover with Rachel voice
async function generateRachelVoiceover(
  script: string,
): Promise<{ success: boolean; audioUrl?: string; error?: string; duration?: number }> {
  try {
    console.log("🎤 Generating Rachel (ElevenLabs) voiceover...")

    if (!process.env.ELEVENLABS_API_KEY) {
      return {
        success: false,
        error: "ElevenLabs API key not configured. Please add ELEVENLABS_API_KEY to environment variables.",
      }
    }

    // Clean script for better TTS
    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\$(\d+)/g, "$1 dollars")
      .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
      .replace(/(\d+)\s*bed/gi, "$1 bedroom")
      .replace(/(\d+)\s*bath/gi, "$1 bathroom")
      .trim()

    console.log(`📝 Cleaned script: ${cleanScript.substring(0, 100)}...`)

    // Use Rachel voice ID (21m00Tcm4TlvDq8ikWAM is Rachel)
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
      console.error("❌ ElevenLabs API error:", response.status, errorText)
      return { success: false, error: `ElevenLabs API error: ${response.status}` }
    }

    const audioBlob = await response.blob()
    if (audioBlob.size === 0) {
      return { success: false, error: "ElevenLabs returned empty audio file" }
    }

    // Convert to data URL
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

    // Estimate duration based on word count (average 150 words per minute)
    const wordCount = cleanScript.split(" ").length
    const estimatedDuration = Math.max(15, (wordCount / 150) * 60)

    console.log("✅ Rachel voiceover generated successfully")
    return {
      success: true,
      audioUrl: audioDataUrl,
      duration: estimatedDuration,
    }
  } catch (error) {
    console.error("❌ Rachel voiceover failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown ElevenLabs error",
    }
  }
}

// Break script into caption chunks for TikTok-style display
function createCaptionChunks(
  script: string,
  duration: number,
): Array<{ text: string; startTime: number; endTime: number }> {
  // Remove emojis and clean text for captions
  const cleanText = script
    .replace(/[^\w\s.,!?'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  // Split into sentences and phrases
  const sentences = cleanText.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const chunks: Array<{ text: string; startTime: number; endTime: number }> = []

  let currentTime = 0
  const timePerChunk = duration / sentences.length

  sentences.forEach((sentence, index) => {
    const words = sentence.trim().split(" ")

    // Break long sentences into smaller chunks (max 6 words for TikTok style)
    if (words.length > 6) {
      const subChunks = []
      for (let i = 0; i < words.length; i += 6) {
        subChunks.push(words.slice(i, i + 6).join(" "))
      }

      const subChunkDuration = timePerChunk / subChunks.length
      subChunks.forEach((chunk, subIndex) => {
        chunks.push({
          text: chunk.trim().toUpperCase(), // TikTok style caps
          startTime: currentTime,
          endTime: currentTime + subChunkDuration,
        })
        currentTime += subChunkDuration
      })
    } else {
      chunks.push({
        text: sentence.trim().toUpperCase(),
        startTime: currentTime,
        endTime: currentTime + timePerChunk,
      })
      currentTime += timePerChunk
    }
  })

  return chunks
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 FINAL VIDEO GENERATION API CALLED")

    const data: VideoRequest = await request.json()
    console.log("📝 Request data:", {
      address: data.address,
      imageCount: data.imageUrls?.length || 0,
      scriptLength: data.script?.length || 0,
    })

    // Validation
    if (!data.address || !data.price || !data.script || !data.imageUrls || data.imageUrls.length === 0) {
      return NextResponse.json({ error: "Missing required data for video generation" }, { status: 400 })
    }

    console.log(`🎬 Generating FINAL VIDEO for ${data.address}`)

    // Step 1: Generate Rachel voiceover
    console.log("🎤 Step 1: Generating Rachel voiceover...")
    const audioResult = await generateRachelVoiceover(data.script)

    if (!audioResult.success) {
      return NextResponse.json(
        {
          error: "Failed to generate Rachel voiceover",
          details: audioResult.error,
        },
        { status: 500 },
      )
    }

    // Step 2: Create caption chunks
    console.log("📝 Step 2: Creating TikTok-style captions...")
    const captionChunks = createCaptionChunks(data.script, audioResult.duration!)

    // Step 3: Calculate video timing
    const totalDuration = Math.ceil(audioResult.duration!)
    const timePerImage = Math.max(3, Math.floor(totalDuration / data.imageUrls.length))

    console.log(`📊 Video timing: ${totalDuration}s total, ${timePerImage}s per image`)

    // Return configuration for client-side video generation
    return NextResponse.json({
      success: true,
      videoConfig: {
        images: data.imageUrls,
        audioUrl: audioResult.audioUrl,
        duration: totalDuration,
        timePerImage,
        captions: captionChunks,
        format: {
          width: 576,
          height: 1024,
          fps: 30,
        },
      },
      property: {
        address: data.address,
        price: data.price,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        sqft: data.sqft,
      },
      metadata: {
        voiceUsed: "Rachel (ElevenLabs)",
        captionCount: captionChunks.length,
        imageCount: data.imageUrls.length,
        totalDuration,
      },
    })
  } catch (error) {
    console.error("❌ Final video generation error:", error)
    return NextResponse.json(
      {
        error: "Final video generation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
