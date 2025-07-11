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
  description: string // This will be the generated script from the frontend
  imageUrls: string[] // URLs from Vercel Blob
}

// Generate text-to-speech audio using Fal AI
async function generateVoiceover(script: string): Promise<string> {
  try {
    const result = await fal.subscribe("fal-ai/tortoise-tts", {
      input: {
        text: script,
        voice: "angie", // Professional female voice
        preset: "fast",
      },
    })
    return result.audio_url
  } catch (error) {
    console.error("Voiceover generation failed:", error)
    // Return placeholder for demo or throw error
    return "https://example.com/placeholder-audio.mp3"
  }
}

// Generate video with property images and voiceover using Fal AI
async function generateVideo(property: PropertyInput, audioUrl: string): Promise<string> {
  try {
    // Use the first uploaded image for video generation
    const primaryImage = property.imageUrls[0] || "/placeholder.svg?height=600&width=400"

    const result = await fal.subscribe("fal-ai/stable-video", {
      input: {
        image_url: primaryImage,
        motion_bucket_id: 127,
        fps: 6,
        duration: 15, // 15 second video
        audio_url: audioUrl,
      },
    })
    return result.video.url
  } catch (error) {
    console.error("Video generation failed:", error)
    // Return placeholder for demo or throw error
    return "https://example.com/placeholder-video.mp4"
  }
}

export async function POST(request: NextRequest) {
  try {
    const propertyData: PropertyInput = await request.json()

    // Basic validation
    if (
      !propertyData.address ||
      !propertyData.price ||
      !propertyData.bedrooms ||
      !propertyData.bathrooms ||
      !propertyData.sqft ||
      !propertyData.description ||
      propertyData.imageUrls.length === 0
    ) {
      return NextResponse.json({ error: "Missing required property details or images." }, { status: 400 })
    }

    console.log("Received property data for video generation:", propertyData.address)

    // Step 1: Generate AI voiceover using the provided description
    console.log("Generating voiceover...")
    const audioUrl = await generateVoiceover(propertyData.description)

    // Step 2: Generate video with property images and voiceover
    console.log("Generating video...")
    const videoUrl = await generateVideo(propertyData, audioUrl)

    console.log("Video generation complete!")

    return NextResponse.json({
      success: true,
      videoUrl,
      listing: propertyData, // Return the input data as 'listing' for consistency
      script: propertyData.description,
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Video generation error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate video. Please try again or contact support if the issue persists.",
      },
      { status: 500 },
    )
  }
}
