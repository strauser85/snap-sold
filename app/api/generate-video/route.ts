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

// Generate ElevenLabs voiceover
async function generateElevenLabsVoiceover(script: string): Promise<string> {
  try {
    console.log("🎤 Generating ElevenLabs voiceover...")

    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured")
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

    console.log(`📝 Cleaned script: ${cleanScript.length} characters`)

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

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ ElevenLabs API error:", response.status, errorText)
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBlob = await response.blob()
    if (audioBlob.size === 0) {
      throw new Error("ElevenLabs returned empty audio")
    }

    // Convert to data URL
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

    console.log("✅ ElevenLabs voiceover generated successfully")
    return audioDataUrl
  } catch (error) {
    console.error("❌ ElevenLabs voiceover failed:", error)
    throw error
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

    // Generate ElevenLabs audio
    let audioUrl = ""
    let audioError = null

    try {
      audioUrl = await generateElevenLabsVoiceover(propertyData.script)
      console.log("✅ ElevenLabs audio generated successfully")
    } catch (error) {
      console.error("❌ ElevenLabs audio failed:", error)
      audioError = error instanceof Error ? error.message : "Audio generation failed"
    }

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
      audioUrl,
      audioError,
      format: {
        width: 576,
        height: 1024,
        fps: 30,
      },
    }

    return NextResponse.json({
      success: true,
      method: "canvas-slideshow",
      audioUrl,
      audioError,
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
        hasAudio: !!audioUrl,
        audioMethod: audioUrl ? "elevenlabs" : "none",
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
