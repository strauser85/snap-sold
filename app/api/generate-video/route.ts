import { type NextRequest, NextResponse } from "next/server"

interface PropertyInput {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription?: string
  script: string
  imageUrls: string[]
}

// Generate ElevenLabs voiceover with better error handling
async function generateElevenLabsVoiceover(
  script: string,
): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
  try {
    console.log("🎤 Starting ElevenLabs generation...")

    // Check if API key exists
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("❌ ELEVENLABS_API_KEY not found in environment variables")
      return {
        success: false,
        error: "ElevenLabs API key not configured. Please add ELEVENLABS_API_KEY to environment variables.",
      }
    }

    console.log(`🔑 ElevenLabs API key found: ${process.env.ELEVENLABS_API_KEY.substring(0, 8)}...`)

    // Clean script for better TTS
    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\$(\d+)/g, "$1 dollars")
      .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
      .replace(/(\d+)\s*bed/gi, "$1 bedroom")
      .replace(/(\d+)\s*bath/gi, "$1 bathroom")
      .trim()

    console.log(`📝 Cleaned script (${cleanScript.length} chars): ${cleanScript.substring(0, 100)}...`)

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

    console.log(`📡 ElevenLabs API response: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ ElevenLabs API error:", response.status, errorText)

      let errorMessage = `ElevenLabs API error: ${response.status}`
      if (response.status === 401) {
        errorMessage = "ElevenLabs API key is invalid or expired"
      } else if (response.status === 429) {
        errorMessage = "ElevenLabs API rate limit exceeded"
      } else if (response.status === 422) {
        errorMessage = "ElevenLabs rejected the text (too long or invalid characters)"
      }

      return { success: false, error: errorMessage }
    }

    const audioBlob = await response.blob()
    console.log(`🎵 Audio blob received: ${audioBlob.size} bytes, type: ${audioBlob.type}`)

    if (audioBlob.size === 0) {
      return { success: false, error: "ElevenLabs returned empty audio file" }
    }

    // Convert to data URL for immediate use
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

    console.log("✅ ElevenLabs voiceover generated successfully")
    console.log(`📊 Audio data URL length: ${audioDataUrl.length} characters`)

    return { success: true, audioUrl: audioDataUrl }
  } catch (error) {
    console.error("❌ ElevenLabs generation failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown ElevenLabs error",
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 Video generation API called")

    const propertyData: PropertyInput = await request.json()
    console.log("📝 Request data:", {
      address: propertyData.address,
      imageCount: propertyData.imageUrls?.length || 0,
      scriptLength: propertyData.script?.length || 0,
    })

    // Validation
    if (
      !propertyData.address ||
      !propertyData.price ||
      !propertyData.script ||
      !propertyData.imageUrls ||
      propertyData.imageUrls.length === 0
    ) {
      console.error("❌ Missing required fields")
      return NextResponse.json({ error: "Missing required property data" }, { status: 400 })
    }

    console.log(`🎬 Generating slideshow for ${propertyData.address}`)

    // Generate ElevenLabs audio with detailed error handling
    const audioResult = await generateElevenLabsVoiceover(propertyData.script)

    console.log("🎤 Audio generation result:", {
      success: audioResult.success,
      hasAudio: !!audioResult.audioUrl,
      error: audioResult.error,
    })

    // Calculate timing
    const wordCount = propertyData.script.split(" ").length
    const estimatedDuration = Math.max(30, wordCount * 0.5)
    const timePerImage = Math.max(3, Math.floor(estimatedDuration / propertyData.imageUrls.length))
    const totalDuration = propertyData.imageUrls.length * timePerImage

    console.log(`📊 Timing: ${timePerImage}s per image, ${totalDuration}s total`)

    const slideshowConfig = {
      images: propertyData.imageUrls,
      timePerImage,
      totalDuration,
      audioUrl: audioResult.audioUrl,
      audioError: audioResult.error,
      audioSuccess: audioResult.success,
      format: {
        width: 576,
        height: 1024,
        fps: 30,
      },
    }

    return NextResponse.json({
      success: true,
      method: "canvas-slideshow-with-audio",
      audioUrl: audioResult.audioUrl,
      audioError: audioResult.error,
      audioSuccess: audioResult.success,
      slideshowConfig,
      script: propertyData.script,
      listing: {
        address: propertyData.address,
        price: propertyData.price,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        sqft: propertyData.sqft,
      },
      metadata: {
        imageCount: propertyData.imageUrls.length,
        hasAudio: audioResult.success,
        audioMethod: audioResult.success ? "elevenlabs" : "none",
      },
      debug: {
        elevenlabsConfigured: !!process.env.ELEVENLABS_API_KEY,
        scriptWordCount: wordCount,
        estimatedDuration,
      },
    })
  } catch (error) {
    console.error("❌ Video generation error:", error)
    return NextResponse.json(
      {
        error: "Video generation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
