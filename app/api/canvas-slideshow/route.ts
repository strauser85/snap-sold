import { type NextRequest, NextResponse } from "next/server"

interface SlideshowRequest {
  imageUrls: string[]
  script: string
  propertyData: {
    address: string
    price: number
    bedrooms: number
    bathrooms: number
    sqft: number
    propertyDescription?: string
  }
}

// Generate voiceover using ElevenLabs ONLY
async function generateElevenLabsVoiceover(script: string): Promise<string> {
  try {
    console.log("🎤 Generating ElevenLabs voiceover (PRIMARY AND ONLY)...")

    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured - this is required for audio generation")
    }

    // Clean script for better TTS
    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ") // Remove special characters except basic punctuation
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\$(\d+)/g, "$1 dollars") // Convert prices to speakable format
      .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
      .replace(/(\d+)\s*bed/gi, "$1 bedroom")
      .replace(/(\d+)\s*bath/gi, "$1 bathroom")
      .trim()

    console.log(`📝 Cleaned script: ${cleanScript.length} characters`)
    console.log(`🔑 Using ElevenLabs API key: ${process.env.ELEVENLABS_API_KEY.substring(0, 8)}...`)

    // Use ElevenLabs Text-to-Speech API with optimized settings
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
          stability: 0.6, // Slightly more stable
          similarity_boost: 0.8, // Higher similarity for consistency
          style: 0.2, // Slight style variation
          use_speaker_boost: true,
        },
        output_format: "mp3_44100_128", // High quality MP3
      }),
    })

    console.log(`📡 ElevenLabs API response: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ ElevenLabs API error:", response.status, errorText)

      // Provide specific error messages
      if (response.status === 401) {
        throw new Error("ElevenLabs API key is invalid or expired")
      } else if (response.status === 429) {
        throw new Error("ElevenLabs API rate limit exceeded - please try again in a moment")
      } else if (response.status === 422) {
        throw new Error("ElevenLabs API rejected the text - script may be too long or contain invalid characters")
      } else {
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
      }
    }

    // Get the audio blob
    const audioBlob = await response.blob()
    console.log(`🎵 ElevenLabs audio generated: ${audioBlob.size} bytes`)

    if (audioBlob.size === 0) {
      throw new Error("ElevenLabs returned empty audio file")
    }

    // Convert blob to data URL for immediate use
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

    console.log("✅ ElevenLabs voiceover generated successfully")
    console.log(`📊 Audio data URL length: ${audioDataUrl.length} characters`)

    return audioDataUrl
  } catch (error) {
    console.error("❌ ElevenLabs voiceover generation failed:", error)
    throw error // Re-throw to fail the entire process
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, script, propertyData }: SlideshowRequest = await request.json()

    console.log(`🎬 CANVAS SLIDESHOW WITH ELEVENLABS ONLY`)
    console.log(`📍 Property: ${propertyData.address}`)
    console.log(`🖼️ Images: ${imageUrls.length} (ALL WILL BE USED)`)
    console.log(`📝 Script: ${script.length} characters`)

    // Step 1: Generate ElevenLabs voiceover (REQUIRED)
    console.log("🎤 Starting ElevenLabs audio generation...")
    const audioUrl = await generateElevenLabsVoiceover(script)
    console.log("✅ ElevenLabs audio generation completed")

    // Step 2: Calculate slideshow timing based on script
    const wordCount = script.split(" ").length
    const estimatedSpeechDuration = Math.max(30, wordCount * 0.5) // 0.5 seconds per word
    const timePerImage = Math.max(3, Math.floor(estimatedSpeechDuration / imageUrls.length))
    const totalDuration = imageUrls.length * timePerImage

    console.log(`📊 SLIDESHOW TIMING:`)
    console.log(`   - ${imageUrls.length} images`)
    console.log(`   - ${timePerImage} seconds per image`)
    console.log(`   - ${totalDuration} seconds total`)
    console.log(`   - ${wordCount} words in script`)
    console.log(`   - Audio method: ElevenLabs ONLY`)

    // Step 3: Return slideshow configuration
    return NextResponse.json({
      success: true,
      audioUrl: audioUrl,
      audioError: null,
      audioMethod: "elevenlabs",
      slideshow: {
        images: imageUrls,
        timePerImage: timePerImage,
        totalDuration: totalDuration,
        transitions: "fade",
        format: {
          width: 576,
          height: 1024,
          fps: 30,
        },
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        method: "canvas-slideshow-elevenlabs-only",
        imageCount: imageUrls.length,
        hasAudio: true,
        audioMethod: "elevenlabs",
        allImagesUsed: true,
        reliable: true,
        cost: "elevenlabs-api",
      },
      instructions: {
        message: "Canvas slideshow with ElevenLabs audio ready",
        nextStep: "Client-side Canvas generation will create the video",
        guarantee: `ALL ${imageUrls.length} images will be used`,
        audioStatus: "ElevenLabs TTS generated successfully",
        fallback: "NONE - ElevenLabs is required",
      },
    })
  } catch (error) {
    console.error("❌ Canvas slideshow API error:", error)

    // Provide specific error message for ElevenLabs failures
    let errorMessage = "Canvas slideshow preparation failed"
    const errorDetails = error instanceof Error ? error.message : String(error)

    if (errorDetails.includes("ElevenLabs")) {
      errorMessage = "ElevenLabs audio generation failed"
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        audioRequired: true,
        solution: "Please ensure ElevenLabs API key is configured and valid",
      },
      { status: 500 },
    )
  }
}
