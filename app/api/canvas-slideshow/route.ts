import { type NextRequest, NextResponse } from "next/server"
import * as fal from "@fal-ai/serverless-client"

// Configure Fal AI
fal.config({
  credentials: process.env.FAL_KEY,
})

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

// Generate voiceover using AI
async function generateVoiceover(script: string): Promise<string> {
  try {
    console.log("🎤 Generating AI voiceover...")

    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    // Try Tortoise TTS first
    try {
      const result = await fal.subscribe("fal-ai/tortoise-tts", {
        input: {
          text: cleanScript,
          voice: "angie",
          preset: "standard",
        },
      })

      if (result.audio_url) {
        console.log("✅ Tortoise TTS voiceover generated:", result.audio_url)
        // Ensure the audio URL is accessible
        const testResponse = await fetch(result.audio_url, { method: "HEAD" })
        if (testResponse.ok) {
          return result.audio_url
        } else {
          console.warn("Audio URL not accessible, trying fallback")
        }
      }
    } catch (error) {
      console.error("Tortoise TTS failed:", error)
    }

    // Try XTTS fallback
    try {
      const result = await fal.subscribe("fal-ai/xtts", {
        input: {
          text: cleanScript,
          speaker: "female_1",
          language: "en",
        },
      })

      if (result.audio_url) {
        console.log("✅ XTTS voiceover generated:", result.audio_url)
        // Ensure the audio URL is accessible
        const testResponse = await fetch(result.audio_url, { method: "HEAD" })
        if (testResponse.ok) {
          return result.audio_url
        }
      }
    } catch (error) {
      console.error("XTTS failed:", error)
    }

    throw new Error("All TTS services failed")
  } catch (error) {
    console.error("Voiceover generation failed:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, script, propertyData }: SlideshowRequest = await request.json()

    console.log(`🎬 CANVAS SLIDESHOW GENERATION`)
    console.log(`📍 Property: ${propertyData.address}`)
    console.log(`🖼️ Images: ${imageUrls.length} (ALL WILL BE USED)`)
    console.log(`📝 Script: ${script.length} characters`)

    // Step 1: Generate AI voiceover
    let audioUrl = ""
    let audioError = null
    try {
      audioUrl = await generateVoiceover(script)
      console.log("✅ AI voiceover generated successfully")
    } catch (error) {
      console.log("⚠️ AI voiceover failed, slideshow will be created without audio")
      audioError = error instanceof Error ? error.message : "Voiceover generation failed"
    }

    // Step 2: Calculate slideshow timing
    const wordCount = script.split(" ").length
    const estimatedSpeechDuration = audioUrl ? Math.max(30, wordCount * 0.5) : 45
    const timePerImage = Math.max(3, Math.floor(estimatedSpeechDuration / imageUrls.length))
    const totalDuration = imageUrls.length * timePerImage

    console.log(`📊 SLIDESHOW TIMING:`)
    console.log(`   - ${imageUrls.length} images`)
    console.log(`   - ${timePerImage} seconds per image`)
    console.log(`   - ${totalDuration} seconds total`)
    console.log(`   - ${wordCount} words in script`)

    // Step 3: Return slideshow configuration for Canvas generation
    return NextResponse.json({
      success: true,
      audioUrl: audioUrl || null,
      audioError: audioError,
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
        method: "canvas-slideshow",
        imageCount: imageUrls.length,
        hasAudio: !!audioUrl,
        allImagesUsed: true,
        reliable: true,
        cost: "free",
      },
      instructions: {
        message: "Canvas slideshow configuration ready",
        nextStep: "Client-side Canvas generation will create the video",
        guarantee: `ALL ${imageUrls.length} images will be used`,
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
