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

// Helper function to convert numbers to words
function numberToWords(num: number): string {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
  const teens = [
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ]
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

  if (num === 0) return "zero"
  if (num < 10) return ones[num]
  if (num < 20) return teens[num - 10]
  if (num < 100) {
    const tenDigit = Math.floor(num / 10)
    const oneDigit = num % 10
    return tens[tenDigit] + (oneDigit > 0 ? " " + ones[oneDigit] : "")
  }

  // For larger numbers, just return the string representation
  return num.toString()
}

// Helper function to format bathroom count for speech
function formatBathrooms(bathrooms: number): string {
  if (bathrooms === Math.floor(bathrooms)) {
    // Whole number
    const word = numberToWords(bathrooms)
    return bathrooms === 1 ? `${word} bathroom` : `${word} bathrooms`
  } else {
    // Decimal (like 2.5)
    const whole = Math.floor(bathrooms)
    const decimal = bathrooms - whole
    if (decimal === 0.5) {
      const wholeWord = numberToWords(whole)
      return `${wholeWord} and a half bathrooms`
    } else {
      return `${bathrooms} bathrooms`
    }
  }
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

    // Convert numbers to words for better speech
    const bedroomsText =
      propertyData.bedrooms === 1
        ? `${numberToWords(propertyData.bedrooms)} bedroom`
        : `${numberToWords(propertyData.bedrooms)} bedrooms`

    const bathroomsText = formatBathrooms(propertyData.bathrooms)
    const sqftText = propertyData.sqft.toLocaleString()
    const priceText = propertyData.price.toLocaleString()

    // Try OpenAI first
    try {
      console.log("🤖 Attempting OpenAI script generation...")

      const prompt = `Create an engaging 30-45 second TikTok script for a real estate listing. Make it energetic, attention-grabbing, and perfect for a female voice (Rachel from ElevenLabs).

Property Details:
- Address: ${propertyData.address}
- Price: $${priceText}
- Bedrooms: ${bedroomsText}
- Bathrooms: ${bathroomsText}
- Square Feet: ${sqftText} square feet
${propertyData.propertyDescription ? `- Description: ${propertyData.propertyDescription}` : ""}
${propertyData.imageCount ? `- Number of photos: ${propertyData.imageCount}` : ""}

CRITICAL REQUIREMENTS:
- Write ALL numbers as words (one, two, three, NOT 1, 2, 3)
- Use full words, NO abbreviations (bedroom NOT BR, bathroom NOT BA, square feet NOT sqft)
- Start with an attention-grabbing hook
- Mention key features and price using full words
- Create urgency and excitement
- End with a clear call-to-action
- Keep it conversational and energetic
- Perfect for TikTok/Instagram Reels
- 30-45 seconds when spoken aloud
- NO emojis or special characters (they cause audio generation issues)
- NO abbreviations whatsoever

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

      // Fallback template with proper word formatting
      script = `Stop scrolling! This property is about to blow your mind!

Welcome to ${propertyData.address}! This stunning home features ${bedroomsText} and ${bathroomsText}, with ${sqftText} square feet of pure luxury.

${propertyData.propertyDescription ? `But wait, there's more! ${propertyData.propertyDescription}` : "This home has everything you need and more!"}

And the best part? It's priced at just ${priceText} dollars. This incredible opportunity won't last long!

Don't let this dream home slip away. Message me right now to schedule your private showing. Seriously, do it now!`

      method = "Template"
    }

    // Clean up the script and remove any abbreviations that might have slipped through
    script = script
      .replace(/\bBR\b/g, "bedrooms")
      .replace(/\bBA\b/g, "bathrooms")
      .replace(/\bsqft\b/g, "square feet")
      .replace(/\bsq ft\b/g, "square feet")
      .replace(/\bft\b/g, "feet")
      .replace(/\b(\d+)\b/g, (match, num) => {
        const number = Number.parseInt(num)
        if (number >= 0 && number <= 100) {
          return numberToWords(number)
        }
        return match
      })
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
