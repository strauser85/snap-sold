import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(request: NextRequest) {
  try {
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount } = await request.json()

    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return NextResponse.json({ error: "Missing required property details" }, { status: 400 })
    }

    const prompt = `Create a compelling 30-45 second TikTok script for a real estate listing with these details:

Address: ${address}
Price: $${price.toLocaleString()}
Bedrooms: ${bedrooms}
Bathrooms: ${bathrooms}
Square Feet: ${sqft.toLocaleString()}
Description: ${propertyDescription || "Beautiful property"}
Number of images: ${imageCount}

The script should:
- Be engaging and viral-worthy for TikTok
- Highlight key features and selling points
- Use natural, conversational language
- Be exactly 30-45 seconds when spoken
- Include price, location, and key features
- Sound excited and professional
- Convert numbers to natural speech (1.5 = "one and a half")

Write only the script text, no stage directions or formatting.`

    try {
      const { text } = await generateText({
        model: openai("gpt-4o"),
        prompt,
        maxTokens: 200,
      })

      return NextResponse.json({
        script: text.trim(),
        method: "OpenAI",
      })
    } catch (aiError) {
      console.warn("OpenAI failed, using template:", aiError)

      // Fallback template
      const script = `Check out this incredible ${bedrooms} bedroom, ${bathrooms} bathroom home at ${address}! With ${sqft.toLocaleString()} square feet of living space, this property offers everything you need. ${propertyDescription ? propertyDescription + " " : ""}Priced at just $${price.toLocaleString()}, this won't last long! Don't miss out on this amazing opportunity. Contact us today to schedule your showing!`

      return NextResponse.json({
        script,
        method: "Template",
      })
    }
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json({ error: "Script generation failed" }, { status: 500 })
  }
}
