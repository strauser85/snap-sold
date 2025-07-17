import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

// Fix abbreviations for proper pronunciation
const fixAbbreviations = (text: string): string => {
  return (
    text
      // Street abbreviations
      .replace(/\bDr\b/g, "Drive")
      .replace(/\bSt\b/g, "Street")
      .replace(/\bAve\b/g, "Avenue")
      .replace(/\bBlvd\b/g, "Boulevard")
      .replace(/\bRd\b/g, "Road")
      .replace(/\bLn\b/g, "Lane")
      .replace(/\bCt\b/g, "Court")
      .replace(/\bCir\b/g, "Circle")
      .replace(/\bPkwy\b/g, "Parkway")
      .replace(/\bTer\b/g, "Terrace")
      .replace(/\bPl\b/g, "Place")
      // Property abbreviations
      .replace(/\bBR\b/g, "bedroom")
      .replace(/\bBRs\b/g, "bedrooms")
      .replace(/\bBA\b/g, "bathroom")
      .replace(/\bBAs\b/g, "bathrooms")
      .replace(/\bsqft\b/gi, "square feet")
      .replace(/\bSQ FT\b/gi, "square feet")
      .replace(/\bsq ft\b/gi, "square feet")
      // Numbers to words for better pronunciation
      .replace(/\b1 bedroom\b/g, "one bedroom")
      .replace(/\b2 bedroom\b/g, "two bedroom")
      .replace(/\b3 bedroom\b/g, "three bedroom")
      .replace(/\b4 bedroom\b/g, "four bedroom")
      .replace(/\b5 bedroom\b/g, "five bedroom")
      .replace(/\b1 bathroom\b/g, "one bathroom")
      .replace(/\b2 bathroom\b/g, "two bathroom")
      .replace(/\b3 bathroom\b/g, "three bathroom")
      .replace(/\b4 bathroom\b/g, "four bathroom")
      .replace(/\b5 bathroom\b/g, "five bathroom")
  )
}

export async function POST(request: NextRequest) {
  try {
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount } = await request.json()

    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return NextResponse.json({ error: "Missing required property details" }, { status: 400 })
    }

    // Fix address abbreviations for proper pronunciation
    const fixedAddress = fixAbbreviations(address)

    const bedroomsText = bedrooms === 1 ? "one bedroom" : `${bedrooms} bedrooms`
    const bathroomsText = bathrooms === 1 ? "one bathroom" : `${bathrooms} bathrooms`

    try {
      // Try OpenAI first
      const { text } = await generateText({
        model: openai("gpt-4o"),
        prompt: `Create a 15-20 second TikTok script for a real estate listing. Make it energetic and engaging for social media.

Property Details:
- Address: ${fixedAddress}
- Price: $${price.toLocaleString()}
- Bedrooms: ${bedroomsText}
- Bathrooms: ${bathroomsText}
- Square Feet: ${sqft.toLocaleString()}
- Description: ${propertyDescription || "Beautiful property"}
- Number of images: ${imageCount}

Requirements:
- Start with an attention-grabbing hook
- Mention key features naturally
- Include the price prominently
- End with a strong call-to-action
- Keep it conversational and exciting
- Optimize for text-to-speech (avoid abbreviations)
- Make sure all street abbreviations are written out (Dr = Drive, St = Street, etc.)

Write ONLY the script text, no additional formatting or labels.`,
      })

      // Apply additional abbreviation fixes to the generated script
      const finalScript = fixAbbreviations(text)

      return NextResponse.json({
        script: finalScript,
        method: "OpenAI",
      })
    } catch (aiError) {
      console.warn("OpenAI failed, using fallback:", aiError)

      // Fallback template with proper pronunciation
      const fallbackScript = `Stop scrolling! This property is about to blow your mind!

Welcome to ${fixedAddress}! This stunning home features ${bedroomsText} and ${bathroomsText}, with ${sqft.toLocaleString()} square feet of pure luxury!

${propertyDescription ? `But wait, there's more! ${propertyDescription}` : "This property has everything you need!"}

Priced at ${price.toLocaleString()} dollars, this property is an incredible opportunity! Don't let this slip away! Message me now!`

      return NextResponse.json({
        script: fixAbbreviations(fallbackScript),
        method: "fallback",
      })
    }
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json(
      { error: "Script generation failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
