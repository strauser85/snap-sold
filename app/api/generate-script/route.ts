import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

const STREET_ABBREVIATIONS: Record<string, string> = {
  Dr: "Drive",
  dr: "Drive",
  ST: "Street",
  St: "Street",
  st: "Street",
  Ave: "Avenue",
  ave: "Avenue",
  AVE: "Avenue",
  Blvd: "Boulevard",
  blvd: "Boulevard",
  Rd: "Road",
  rd: "Road",
  Ln: "Lane",
  ln: "Lane",
  Ct: "Court",
  ct: "Court",
  Cir: "Circle",
  cir: "Circle",
  Pkwy: "Parkway",
  pkwy: "Parkway",
}

function expandStreetAbbreviations(address: string): string {
  return address
    .split(" ")
    .map((word) => STREET_ABBREVIATIONS[word] ?? word)
    .join(" ")
}

function convertNumbersToNaturalSpeech(text: string): string {
  return (
    text
      // Handle decimal numbers first
      .replace(/\b(\d+)\.5\b/g, "$1 and a half")
      .replace(/\b1\.5\b/g, "one and a half")
      .replace(/\b2\.5\b/g, "two and a half")
      .replace(/\b3\.5\b/g, "three and a half")
      .replace(/\b4\.5\b/g, "four and a half")
      .replace(/\b5\.5\b/g, "five and a half")
      // Handle large numbers
      .replace(/\b(\d{1,3}),(\d{3}),(\d{3})\b/g, (match, millions, thousands, hundreds) => {
        const millionNum = Number.parseInt(millions)
        const thousandNum = Number.parseInt(thousands)
        const hundredNum = Number.parseInt(hundreds)

        let result = ""
        if (millionNum > 0) {
          result += numberToWords(millionNum) + " million "
        }
        if (thousandNum > 0) {
          result += numberToWords(thousandNum) + " thousand "
        }
        if (hundredNum > 0) {
          result += numberToWords(hundredNum)
        }
        return result.trim()
      })
      // Handle thousands
      .replace(/\b(\d{1,3}),(\d{3})\b/g, (match, thousands, hundreds) => {
        const thousandNum = Number.parseInt(thousands)
        const hundredNum = Number.parseInt(hundreds)

        let result = ""
        if (thousandNum > 0) {
          result += numberToWords(thousandNum) + " thousand "
        }
        if (hundredNum > 0) {
          result += numberToWords(hundredNum)
        }
        return result.trim()
      })
      // Handle 4-digit numbers without commas (like 2703)
      .replace(/\b(\d{4})\b/g, (match, num) => {
        const number = Number.parseInt(num)
        if (number >= 1000 && number <= 9999) {
          const thousands = Math.floor(number / 1000)
          const remainder = number % 1000
          if (remainder === 0) {
            return numberToWords(thousands) + " thousand"
          } else if (remainder < 100) {
            return numberToWords(thousands) + " thousand " + numberToWords(remainder)
          } else {
            // For numbers like 2703, say "twenty-seven oh three"
            const hundreds = Math.floor(remainder / 100)
            const tens = remainder % 100
            if (tens < 10) {
              return numberToWords(thousands * 10 + hundreds) + " oh " + numberToWords(tens)
            } else {
              return numberToWords(thousands * 10 + hundreds) + " " + numberToWords(tens)
            }
          }
        }
        return match
      })
      // Handle price formatting
      .replace(/\$(\d+)/g, "$1 dollars")
  )
}

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
  const hundreds = [
    "",
    "one hundred",
    "two hundred",
    "three hundred",
    "four hundred",
    "five hundred",
    "six hundred",
    "seven hundred",
    "eight hundred",
    "nine hundred",
  ]

  if (num === 0) return "zero"
  if (num < 10) return ones[num]
  if (num < 20) return teens[num - 10]
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "")
  if (num < 1000) return hundreds[Math.floor(num / 100)] + (num % 100 ? " " + numberToWords(num % 100) : "")

  return num.toString() // Fallback for very large numbers
}

function determineListingTone(price: number, description: string): string {
  const priceRange = price < 300000 ? "affordable" : price > 800000 ? "luxury" : "mid-range"
  const hasLuxuryKeywords = /luxury|premium|executive|custom|gourmet|marble|granite|hardwood|crown molding/i.test(
    description,
  )
  const hasFamilyKeywords = /family|kids|children|playground|school|neighborhood|safe|quiet/i.test(description)

  if (hasLuxuryKeywords || priceRange === "luxury") return "luxury"
  if (hasFamilyKeywords) return "family"
  if (priceRange === "affordable") return "affordable"
  return "professional"
}

function generateCallToAction(tone: string): string {
  switch (tone) {
    case "luxury":
      return "Contact me today to schedule your private showing."
    case "family":
      return "Schedule a showing today and see why this could be your family's perfect home."
    case "affordable":
      return "Don't wait - call me today to see this great value."
    default:
      return "DM me now to schedule a showing."
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount } = body

    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const expandedAddress = expandStreetAbbreviations(address)
    const numPrice = Number(price)
    const numBedrooms = Number(bedrooms)
    const numBathrooms = Number(bathrooms)
    const numSqft = Number(sqft)

    const tone = determineListingTone(numPrice, propertyDescription || "")
    const callToAction = generateCallToAction(tone)

    let script = ""
    let method = "Template"

    // Try OpenAI first if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `Create a professional, natural-sounding voiceover script for a real estate listing video. 

Property Details:
- Address: ${expandedAddress}
- Price: $${numPrice.toLocaleString()}
- Bedrooms: ${numBedrooms}
- Bathrooms: ${numBathrooms}
- Square Feet: ${numSqft.toLocaleString()}
- Description: ${propertyDescription || "Beautiful home with great features"}

Requirements:
- 30-45 seconds when spoken aloud
- Professional, confident, and natural tone (not robotic)
- Use the property description as the core narrative
- Integrate listing data naturally without repetition
- No emojis, hashtags, or social media formatting
- No generic hype phrases like "won't last long"
- Focus on unique features from the description
- End with: "${callToAction}"
- Sound like a professional real estate agent narrating
- Avoid redundancy like saying "3 bedrooms" and "3BR" separately

Write only the script text suitable for voiceover narration.`

        const { text } = await generateText({
          model: openai("gpt-4o"),
          prompt,
          maxTokens: 300,
          temperature: 0.7,
        })

        script = convertNumbersToNaturalSpeech(text.trim())
        method = "OpenAI"
      } catch (error) {
        console.warn("OpenAI failed, using template:", error)
      }
    }

    // Professional template fallback
    if (!script) {
      const bedroomText = numBedrooms === 1 ? "one bedroom" : `${numBedrooms} bedrooms`
      const bathroomText =
        numBathrooms === 1
          ? "one bathroom"
          : numBathrooms.toString().includes(".5")
            ? `${numBathrooms.toString().replace(".5", " and a half")} bathrooms`
            : `${numBathrooms} bathrooms`

      // Extract key features from description
      const features = propertyDescription
        ? propertyDescription
            .split(/[,.!;]/)
            .map((f) => f.trim())
            .filter((f) => f.length > 10 && f.length < 80)
            .slice(0, 2)
        : []

      // Build script based on tone
      if (tone === "luxury") {
        script = `Welcome to ${expandedAddress}. This exceptional ${bedroomText}, ${bathroomText} residence offers ${numSqft.toLocaleString()} square feet of refined living space. ${
          features.length > 0 ? features.join(". ") + ". " : ""
        }Priced at ${numPrice.toLocaleString()} dollars, this property represents the finest in luxury living. ${callToAction}`
      } else if (tone === "family") {
        script = `Discover your family's next home at ${expandedAddress}. This welcoming ${bedroomText}, ${bathroomText} home provides ${numSqft.toLocaleString()} square feet of comfortable living space. ${
          features.length > 0 ? features.join(". ") + ". " : ""
        }At ${numPrice.toLocaleString()} dollars, it offers excellent value for growing families. ${callToAction}`
      } else {
        script = `Located at ${expandedAddress}, this well-appointed ${bedroomText}, ${bathroomText} home features ${numSqft.toLocaleString()} square feet of thoughtfully designed space. ${
          features.length > 0 ? features.join(". ") + ". " : ""
        }Offered at ${numPrice.toLocaleString()} dollars. ${callToAction}`
      }

      script = convertNumbersToNaturalSpeech(script)
    }

    return NextResponse.json({
      script: script || "Unable to generate script. Please try again.",
      method,
      tone,
      wordCount: script.split(" ").length,
      estimatedDuration: Math.round((script.split(" ").length / 150) * 60), // ~150 words per minute
    })
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json(
      {
        error: "Script generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
