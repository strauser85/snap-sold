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

function formatNumbersForSpeech(text: string): string {
  return text
    .replace(/\b(\d+)\.5\b/g, "$1 and a half")
    .replace(/\b1\.5\b/g, "one and a half")
    .replace(/\b2\.5\b/g, "two and a half")
    .replace(/\b3\.5\b/g, "three and a half")
    .replace(/\b4\.5\b/g, "four and a half")
    .replace(/\b5\.5\b/g, "five and a half")
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
      return "Schedule your showing today."
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
- Use natural speech for numbers (1.5 = "one and a half")
- Sound like a professional real estate agent narrating

Write only the script text suitable for voiceover narration.`

        const { text } = await generateText({
          model: openai("gpt-4o"),
          prompt,
          maxTokens: 300,
          temperature: 0.7,
        })

        script = formatNumbersForSpeech(text.trim())
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

      script = formatNumbersForSpeech(script)
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
