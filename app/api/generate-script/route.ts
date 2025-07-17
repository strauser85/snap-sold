import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

const numberToWords = (num: number): string => {
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
  if (num < 1000) {
    const hundreds = Math.floor(num / 100)
    const remainder = num % 100
    return ones[hundreds] + " hundred" + (remainder > 0 ? " " + numberToWords(remainder) : "")
  }
  return num.toString()
}

export async function POST(request: NextRequest) {
  try {
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount } = await request.json()

    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return NextResponse.json({ error: "Missing required property details" }, { status: 400 })
    }

    const safePrice = Number(price) || 0
    const safeBedrooms = Number(bedrooms) || 0
    const safeBathrooms = Number(bathrooms) || 0
    const safeSqft = Number(sqft) || 0

    const bedroomsText =
      safeBedrooms === 1 ? `${numberToWords(safeBedrooms)} bedroom` : `${numberToWords(safeBedrooms)} bedrooms`
    const bathroomsText =
      safeBathrooms === 1 ? `${numberToWords(safeBathrooms)} bathroom` : `${numberToWords(safeBathrooms)} bathrooms`

    try {
      const { text } = await generateText({
        model: openai("gpt-4o"),
        system: `Create viral TikTok real estate scripts. Use conversational tone, spell out numbers as words, include strong hooks and calls-to-action. Keep under 45 seconds when spoken. Always say "square feet" not "sqft".`,
        prompt: `Create a TikTok script for: ${address}, $${safePrice.toLocaleString()}, ${bedroomsText}, ${bathroomsText}, ${safeSqft.toLocaleString()} square feet. ${propertyDescription ? `Features: ${propertyDescription}` : ""} Make it exciting and viral-worthy!`,
      })

      const cleanedScript = text
        .replace(/\bBR\b/gi, "bedrooms")
        .replace(/\bBA\b/gi, "bathrooms")
        .replace(/\bsqft\b/gi, "square feet")
        .replace(/\bSQ FT\b/gi, "square feet")
        .replace(/\bsq ft\b/gi, "square feet")
        .replace(/\d+/g, (match) => {
          const num = Number.parseInt(match)
          return isNaN(num) ? match : numberToWords(num)
        })

      return NextResponse.json({ script: cleanedScript, method: "OpenAI" })
    } catch (aiError) {
      console.warn("OpenAI failed, using fallback:", aiError)

      let fallbackScript = `Stop scrolling! This property is about to blow your mind!\n\nWelcome to ${address}! This stunning home features ${bedroomsText} and ${bathroomsText}, with ${safeSqft.toLocaleString()} square feet of pure luxury!`

      if (propertyDescription?.trim()) {
        fallbackScript += `\n\nBut wait, there's more! ${propertyDescription.trim()}`
      }

      fallbackScript += `\n\nPriced at ${safePrice.toLocaleString()} dollars, this property is an incredible opportunity! Don't let this slip away! Message me now for a private showing!`

      return NextResponse.json({ script: fallbackScript, method: "fallback" })
    }
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json(
      { error: "Script generation failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
