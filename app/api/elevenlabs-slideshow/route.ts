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

async function generateElevenLabsVoiceover(script: string): Promise<string> {
  console.log("🎤 Starting ElevenLabs generation...")

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured")
  }

  // Clean and optimize script
  const cleanScript = script
    .replace(/[^\w\s.,!?'-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\$(\d+)/g, "$1 dollars")
    .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
    .replace(/(\d+)\s*bed/gi, "$1 bedroom")
    .replace(/(\d+)\s*bath/gi, "$1 bathroom")
    .trim()

  console.log(`📝 Script cleaned: ${cleanScript.length} chars`)

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

  const arrayBuffer = await audioBlob.arrayBuffer()
  const base64Audio = Buffer.from(arrayBuffer).toString("base64")
  const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

  console.log("✅ ElevenLabs audio generated successfully")
  return audioDataUrl
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, script, propertyData }: SlideshowRequest = await request.json()

    console.log("🎬 ELEVENLABS SLIDESHOW API")
    console.log(`📍 Property: ${propertyData.address}`)
    console.log(`🖼️ Images: ${imageUrls.length}`)
    console.log(`📝 Script: ${script.length} chars`)

    // Generate ElevenLabs audio
    const audioUrl = await generateElevenLabsVoiceover(script)

    // Calculate timing
    const wordCount = script.split(" ").length
    const estimatedDuration = Math.max(30, wordCount * 0.5)
    const timePerImage = Math.max(3, Math.floor(estimatedDuration / imageUrls.length))
    const totalDuration = imageUrls.length * timePerImage

    console.log(`📊 Timing: ${timePerImage}s per image, ${totalDuration}s total`)

    return NextResponse.json({
      success: true,
      audioUrl,
      slideshow: {
        images: imageUrls,
        timePerImage,
        totalDuration,
        format: {
          width: 576,
          height: 1024,
          fps: 30,
        },
      },
    })
  } catch (error) {
    console.error("❌ ElevenLabs slideshow error:", error)
    return NextResponse.json(
      {
        error: "ElevenLabs slideshow failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
