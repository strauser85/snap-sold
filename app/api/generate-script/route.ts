import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { type NextRequest, NextResponse } from "next/server"

interface PropertyData {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  imageCount?: number
}

export async function POST(request: NextRequest) {
  try {
    const propertyData: PropertyData = await request.json()

    const { address, price, bedrooms, bathrooms, sqft, imageCount = 1 } = propertyData

    // Generate AI-powered persuasive script optimized for multiple images
    const { text: script } = await generateText({
      model: openai("gpt-4o"),
      system: `You are a top real estate marketing expert who creates viral TikTok scripts. Create engaging, persuasive voiceover scripts for property videos that:

1. Hook viewers in the first 3 seconds with a compelling question or statement
2. Use urgency and scarcity tactics ("This won't last long!")
3. Highlight key selling points and lifestyle benefits
4. Include emotional triggers and investment potential
5. Reference multiple property features since we have ${imageCount} images to showcase
6. End with a strong call-to-action
7. Are 45-60 seconds when spoken (about 150-200 words for ${imageCount} images)
8. Use casual, energetic TikTok language with strategic pauses
9. Include relevant emojis and power words
10. Create anticipation for each room/feature reveal

The script should feel authentic and exciting, not salesy. Focus on lifestyle transformation and investment opportunity. Since we have multiple images, structure the script to flow through different property features.`,
      prompt: `Create a viral TikTok voiceover script for this property with ${imageCount} images to showcase:

Address: ${address}
Price: $${price.toLocaleString()}
Bedrooms: ${bedrooms}
Bathrooms: ${bathrooms}
Square Feet: ${sqft.toLocaleString()}
Images Available: ${imageCount} photos

Structure the script to flow through multiple property features since we have ${imageCount} images. Make it compelling for potential buyers and investors. Include hooks, benefits, urgency, and strong call-to-action. Reference different rooms/areas that the images will show.`,
    })

    return NextResponse.json({
      success: true,
      script: script.trim(),
    })
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json({ error: "Failed to generate script. Please try again." }, { status: 500 })
  }
}
