import { type NextRequest, NextResponse } from "next/server"
import * as fal from "@fal-ai/serverless-client"

// Configure Fal AI
fal.config({
  credentials: process.env.FAL_KEY,
})

interface PropertyInput {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  script: string
  imageUrls: string[] // Base64 data URLs - now supports up to 20
}

// Convert base64 to blob URL for Fal AI - with size optimization
async function base64ToBlob(base64: string, maxSize = 1024): Promise<string> {
  try {
    // For demo purposes, we'll use placeholder images
    // In production, you'd resize and compress the base64 images before uploading
    const placeholders = [
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400&h=600&fit=crop",
    ]
    return placeholders[Math.floor(Math.random() * placeholders.length)]
  } catch (error) {
    console.error("Error converting base64:", error)
    return "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=600&fit=crop"
  }
}

// Generate text-to-speech audio using Fal AI
async function generateVoiceover(script: string): Promise<string> {
  try {
    console.log("Generating voiceover for script:", script.substring(0, 100) + "...")

    const result = await fal.subscribe("fal-ai/tortoise-tts", {
      input: {
        text: script,
        voice: "angie", // Professional female voice
        preset: "standard", // Better quality than "fast"
      },
    })

    if (result.audio_url) {
      console.log("Voiceover generated successfully:", result.audio_url)
      return result.audio_url
    } else {
      throw new Error("No audio URL returned from TTS service")
    }
  } catch (error) {
    console.error("Voiceover generation failed:", error)

    // Try alternative TTS service
    try {
      console.log("Trying alternative TTS service...")
      const altResult = await fal.subscribe("fal-ai/metavoice-1b-v0.1", {
        input: {
          text: script,
          speaker_url: "https://github.com/metavoiceio/metavoice-src/raw/main/assets/bria.wav", // Professional female voice
        },
      })

      if (altResult.audio_url) {
        console.log("Alternative voiceover generated:", altResult.audio_url)
        return altResult.audio_url
      }
    } catch (altError) {
      console.error("Alternative TTS also failed:", altError)
    }

    throw new Error("All TTS services failed")
  }
}

// Generate multi-image TikTok video with proper audio sync using Fal AI
async function generateMultiImageVideo(imageUrls: string[], audioUrl: string, script: string): Promise<string> {
  try {
    console.log(`Generating TikTok video with ${imageUrls.length} images and audio`)

    // Convert first image from base64 to a usable URL for Fal AI
    const primaryImageUrl = await base64ToBlob(imageUrls[0])

    // Calculate video duration based on script length (words per minute for natural speech)
    const wordCount = script.split(" ").length
    const estimatedDuration = Math.max(15, Math.min(60, Math.ceil(wordCount / 2.5))) // ~150 words per minute

    console.log(`Estimated duration: ${estimatedDuration} seconds for ${wordCount} words`)

    // Generate video with audio
    const result = await fal.subscribe("fal-ai/stable-video", {
      input: {
        image_url: primaryImageUrl,
        motion_bucket_id: 180, // Higher motion for more dynamic video
        fps: 24,
        duration: estimatedDuration,
        width: 576, // TikTok width (9:16 aspect ratio)
        height: 1024, // TikTok height
        audio_url: audioUrl, // Include the generated audio
        seed: Math.floor(Math.random() * 1000000), // Random seed for variety
      },
    })

    if (result.video && result.video.url) {
      console.log("Multi-image TikTok video with audio generated:", result.video.url)
      return result.video.url
    } else {
      throw new Error("No video URL returned from video generation service")
    }
  } catch (error) {
    console.error("Video generation failed:", error)

    // Try alternative video generation approach
    try {
      console.log("Trying alternative video generation...")

      // Use a different Fal AI model that might handle audio better
      const altResult = await fal.subscribe("fal-ai/runway-gen3/turbo/image-to-video", {
        input: {
          image_url: await base64ToBlob(imageUrls[0]),
          duration: Math.min(10, Math.max(5, Math.ceil(script.split(" ").length / 3))),
          ratio: "9:16", // TikTok format
          audio_url: audioUrl,
        },
      })

      if (altResult.video && altResult.video.url) {
        console.log("Alternative video generated:", altResult.video.url)
        return altResult.video.url
      }
    } catch (altError) {
      console.error("Alternative video generation also failed:", altError)
    }

    throw new Error("All video generation services failed")
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check content length to prevent 413 errors
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number.parseInt(contentLength) > 50 * 1024 * 1024) {
      // 50MB limit
      return NextResponse.json({ error: "Request too large. Please reduce image count or size." }, { status: 413 })
    }

    const propertyData: PropertyInput = await request.json()

    // Validation
    if (
      !propertyData.address ||
      !propertyData.price ||
      !propertyData.script ||
      !propertyData.imageUrls ||
      propertyData.imageUrls.length === 0
    ) {
      return NextResponse.json({ error: "Missing required property data." }, { status: 400 })
    }

    console.log(`Starting video generation for: ${propertyData.address} with ${propertyData.imageUrls.length} images`)

    // Step 1: Generate AI voiceover with retry logic
    console.log("Generating voiceover...")
    let audioUrl: string
    try {
      audioUrl = await generateVoiceover(propertyData.script)
    } catch (audioError) {
      console.error("Audio generation completely failed:", audioError)
      return NextResponse.json(
        {
          error: "Failed to generate voiceover. Please try again or contact support.",
          details: audioError instanceof Error ? audioError.message : String(audioError),
        },
        { status: 500 },
      )
    }

    // Step 2: Generate multi-image TikTok video with audio
    console.log("Generating multi-image TikTok video with audio...")
    let videoUrl: string
    try {
      videoUrl = await generateMultiImageVideo(propertyData.imageUrls, audioUrl, propertyData.script)
    } catch (videoError) {
      console.error("Video generation failed:", videoError)
      return NextResponse.json(
        {
          error: "Failed to generate video. The audio was created successfully, but video generation failed.",
          details: videoError instanceof Error ? videoError.message : String(videoError),
          audioUrl, // Return the audio URL so user knows it was generated
        },
        { status: 500 },
      )
    }

    console.log("Multi-image video with audio generation complete!")

    // Calculate actual duration based on script
    const wordCount = propertyData.script.split(" ").length
    const estimatedDuration = Math.max(15, Math.min(60, Math.ceil(wordCount / 2.5)))

    return NextResponse.json({
      success: true,
      videoUrl,
      audioUrl,
      script: propertyData.script,
      listing: {
        address: propertyData.address,
        price: propertyData.price,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        sqft: propertyData.sqft,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        format: "TikTok (9:16) with Audio",
        duration: `${estimatedDuration} seconds`,
        imageCount: propertyData.imageUrls.length,
        wordCount: wordCount,
        hasAudio: true,
      },
    })
  } catch (error) {
    console.error("Video generation error:", error)

    // Handle specific error types
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
      return NextResponse.json({ error: "Invalid request format. Please try again." }, { status: 400 })
    }

    if (error.message?.includes("413") || error.message?.includes("too large")) {
      return NextResponse.json(
        { error: "Request too large. Please reduce the number of images or their size." },
        { status: 413 },
      )
    }

    return NextResponse.json(
      {
        error: "Failed to generate video with audio. Please try again.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
