import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export const maxDuration = 30

interface PropertyData {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription?: string
  imageCount?: number
}

export async function POST(request: NextRequest) {
  try {
    const propertyData: PropertyData = await request.json()
    console.log("🏠 Generating script for:", propertyData.address)

    // Validate required fields
    if (
      !propertyData.address ||
      !propertyData.price ||
      !propertyData.bedrooms ||
      !propertyData.bathrooms ||
      !propertyData.sqft
    ) {
      return NextResponse.json({ error: "Missing required property data" }, { status: 400 })
    }

    let script = ""
    let method = ""

    // Try OpenAI first
    try {
      console.log("🤖 Attempting OpenAI script generation...")

      const prompt = `Create an engaging 30-45 second TikTok script for a real estate listing. Make it energetic, attention-grabbing, and perfect for a female voice (Rachel from ElevenLabs).

Property Details:
- Address: ${propertyData.address}
- Price: $${propertyData.price.toLocaleString()}
- Bedrooms: ${propertyData.bedrooms}
- Bathrooms: ${propertyData.bathrooms}
- Square Feet: ${propertyData.sqft.toLocaleString()}
${propertyData.propertyDescription ? `- Description: ${propertyData.propertyDescription}` : ""}
${propertyData.imageCount ? `- Number of photos: ${propertyData.imageCount}` : ""}

Requirements:
- Start with an attention-grabbing hook
- Mention key features and price
- Create urgency and excitement
- End with a clear call-to-action
- Keep it conversational and energetic
- Perfect for TikTok/Instagram Reels
- 30-45 seconds when spoken aloud
- NO emojis or special characters (they cause audio generation issues)

Write ONLY the script text, nothing else.`

      const result = await generateText({
        model: openai("gpt-4o-mini"),
        prompt,
        maxTokens: 300,
        temperature: 0.8,
      })

      script = result.text.trim()
      method = "OpenAI"
      console.log("✅ OpenAI script generated successfully")
    } catch (openaiError) {
      console.warn("⚠️ OpenAI failed, using fallback template:", openaiError)

      // Fallback template
      const bedroomText = propertyData.bedrooms === 1 ? "1 bedroom" : `${propertyData.bedrooms} bedrooms`
      const bathroomText = propertyData.bathrooms === 1 ? "1 bathroom" : `${propertyData.bathrooms} bathrooms`

      script = `Stop scrolling! This property is about to blow your mind!

Welcome to ${propertyData.address}! This stunning home features ${bedroomText} and ${bathroomText}, with ${propertyData.sqft.toLocaleString()} square feet of pure luxury.

${propertyData.propertyDescription ? `But wait, there's more! ${propertyData.propertyDescription}` : "This home has everything you need and more!"}

And the best part? It's priced at just ${propertyData.price.toLocaleString()} dollars. This incredible opportunity won't last long!

Don't let this dream home slip away. Message me right now to schedule your private showing. Seriously, do it now!`

      method = "Template"
    }

    // Clean up the script
    script = script
      .replace(/[^\w\s.,!?$-]/g, "") // Remove special characters but keep basic punctuation
      .replace(/\s+/g, " ")
      .trim()

    console.log(`📝 Generated script (${method}): ${script.length} characters`)

    return NextResponse.json({
      script,
      method,
      length: script.length,
      estimatedDuration: Math.ceil(script.split(" ").length / 3), // Rough estimate: 3 words per second
    })
  } catch (error) {
    console.error("❌ Script generation error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate script",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
