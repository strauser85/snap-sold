import { type NextRequest, NextResponse } from "next/server"

interface ScriptRequest {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription?: string
  imageCount: number
}

// Helper function to convert numbers to words
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

  return num.toString()
}

export async function POST(request: NextRequest) {
  try {
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount }: ScriptRequest =
      await request.json()

    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return NextResponse.json({ error: "Missing required property details" }, { status: 400 })
    }

    // Convert numbers to words for better pronunciation
    const bedroomsText = bedrooms === 1 ? `${numberToWords(bedrooms)} bedroom` : `${numberToWords(bedrooms)} bedrooms`
    const bathroomsText =
      bathrooms === 1 ? `${numberToWords(bathrooms)} bathroom` : `${numberToWords(bathrooms)} bathrooms`

    let script = ""

    // Try OpenAI first if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are a viral TikTok real estate content creator. Create engaging, energetic scripts that grab attention immediately.

CRITICAL RULES:
- NO abbreviations whatsoever (never use BR, BA, sqft, etc.)
- Always spell out numbers as words (1 = one, 2 = two, 3 = three, etc.)
- Use full words: "bedrooms" not "BR", "bathrooms" not "BA", "square feet" not "sqft"
- Keep it under 45 seconds when spoken
- Start with a hook that stops scrolling
- Use excitement and urgency
- End with a strong call to action
- Make it sound natural when spoken aloud`,
              },
              {
                role: "user",
                content: `Create a viral TikTok script for this property:
- Address: ${address}
- Price: $${price.toLocaleString()}
- ${bedroomsText}
- ${bathroomsText}  
- ${sqft.toLocaleString()} square feet
${propertyDescription ? `- Special features: ${propertyDescription}` : ""}
- ${imageCount} photos available

Remember: NO abbreviations, spell out all numbers as words, make it exciting!`,
              },
            ],
            max_tokens: 400,
            temperature: 0.8,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          script = data.choices[0].message.content.trim()

          // Clean up any abbreviations that might slip through
          script = script
            .replace(/\bBR\b/g, "bedrooms")
            .replace(/\bBA\b/g, "bathrooms")
            .replace(/\bsqft\b/g, "square feet")
            .replace(/\bSQ FT\b/g, "square feet")
            .replace(/\d+/g, (match) => numberToWords(Number.parseInt(match)))

          return NextResponse.json({
            script,
            method: "OpenAI",
          })
        }
      } catch (error) {
        console.warn("OpenAI script generation failed:", error)
      }
    }

    // Fallback template script
    script = `Stop scrolling! This property is about to blow your mind!

Welcome to ${address}! This stunning home features ${bedroomsText} and ${bathroomsText}, with ${sqft.toLocaleString()} square feet of pure luxury!`

    if (propertyDescription?.trim()) {
      script += `

But wait, there's more! ${propertyDescription.trim()}`
    }

    script += `

Priced at ${price.toLocaleString()} dollars, this property is an incredible opportunity! Don't let this slip away! Message me now for a private showing!`

    return NextResponse.json({
      script,
      method: "template",
    })
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json(
      {
        error: "Script generation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
