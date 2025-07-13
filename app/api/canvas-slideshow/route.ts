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

// Generate voiceover using ElevenLabs
async function generateElevenLabsVoiceover(script: string): Promise<string> {
  try {
    console.log("🎤 Generating ElevenLabs voiceover...")

    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured")
    }

    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    console.log(`Script length: ${cleanScript.length} characters`)

    // Use ElevenLabs Text-to-Speech API
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
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs API error:", response.status, errorText)
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    // Get the audio blob
    const audioBlob = await response.blob()
    console.log(`ElevenLabs audio generated: ${audioBlob.size} bytes`)

    // Convert blob to data URL for immediate use
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

    console.log("✅ ElevenLabs voiceover generated successfully")
    return audioDataUrl
  } catch (error) {
    console.error("ElevenLabs voiceover generation failed:", error)
    throw error
  }
}

// Fallback TTS using browser Speech Synthesis (server-side preparation)
function generateFallbackScript(script: string): string {
  console.log("⚠️ Using fallback TTS preparation")

  // Clean and optimize script for speech synthesis
  const cleanScript = script
    .replace(/[^\w\s.,!?'-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\$(\d+)/g, "$1 dollars") // Convert prices to speakable format
    .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
    .replace(/(\d+)\s*bed/gi, "$1 bedroom")
    .replace(/(\d+)\s*bath/gi, "$1 bathroom")
    .trim()

  return cleanScript
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, script, propertyData }: SlideshowRequest = await request.json()

    console.log(`🎬 CANVAS SLIDESHOW WITH ELEVENLABS`)
    console.log(`📍 Property: ${propertyData.address}`)
    console.log(`🖼️ Images: ${imageUrls.length} (ALL WILL BE USED)`)
    console.log(`📝 Script: ${script.length} characters`)

    // Step 1: Generate ElevenLabs voiceover
    let audioUrl = ""
    let audioError = null
    let audioMethod = "none"

    try {
      audioUrl = await generateElevenLabsVoiceover(script)
      audioMethod = "elevenlabs"
      console.log("✅ ElevenLabs voiceover generated successfully")
    } catch (error) {
      console.log("⚠️ ElevenLabs failed, preparing fallback TTS")
      audioError = error instanceof Error ? error.message : "ElevenLabs generation failed"

      // Prepare script for browser-based TTS fallback
      const optimizedScript = generateFallbackScript(script)
      audioMethod = "browser-fallback"

      // Return script for browser TTS instead of audio URL
      audioUrl = `tts:${optimizedScript}`
    }

    // Step 2: Calculate slideshow timing
    const wordCount = script.split(" ").length
    const estimatedSpeechDuration =
      audioMethod === "elevenlabs" ? Math.max(30, wordCount * 0.5) : Math.max(45, wordCount * 0.6)
    const timePerImage = Math.max(3, Math.floor(estimatedSpeechDuration / imageUrls.length))
    const totalDuration = imageUrls.length * timePerImage

    console.log(`📊 SLIDESHOW TIMING:`)
    console.log(`   - ${imageUrls.length} images`)
    console.log(`   - ${timePerImage} seconds per image`)
    console.log(`   - ${totalDuration} seconds total`)
    console.log(`   - ${wordCount} words in script`)
    console.log(`   - Audio method: ${audioMethod}`)

    // Step 3: Return slideshow configuration
    return NextResponse.json({
      success: true,
      audioUrl: audioUrl || null,
      audioError: audioError,
      audioMethod: audioMethod,
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
        method: "canvas-slideshow-elevenlabs",
        imageCount: imageUrls.length,
        hasAudio: !!audioUrl,
        audioMethod: audioMethod,
        allImagesUsed: true,
        reliable: true,
        cost: audioMethod === "elevenlabs" ? "elevenlabs-api" : "free",
      },
      instructions: {
        message: "Canvas slideshow with ElevenLabs audio ready",
        nextStep: "Client-side Canvas generation will create the video",
        guarantee: `ALL ${imageUrls.length} images will be used`,
        audioStatus: audioMethod === "elevenlabs" ? "ElevenLabs TTS generated" : "Browser TTS fallback prepared",
      },
    })
  } catch (error) {
    console.error("Canvas slideshow API error:", error)
    return NextResponse.json(
      {
        error: "Canvas slideshow preparation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
