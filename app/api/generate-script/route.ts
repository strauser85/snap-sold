import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

// Street abbreviations for natural pronunciation
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
    .map((word) => STREET_ABBREVIATIONS[word] || word)
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

export async function POST(request: NextRequest) {
  try {
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount } = await request.json()

    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return NextResponse.json({ error: "All property details are required" }, { status: 400 })
    }

    const expandedAddress = expandStreetAbbreviations(address)

    let script = ""
    let method = "Template"

    // Try OpenAI first
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `Create a compelling 30-45 second TikTok script for a real estate listing with these details:

Address: ${expandedAddress}
Price: $${Number(price).toLocaleString()}
Bedrooms: ${bedrooms}
Bathrooms: ${bathrooms}
Square Feet: ${Number(sqft).toLocaleString()}
${propertyDescription ? `Description: ${propertyDescription}` : ""}
Images: ${imageCount} photos available

Requirements:
- Engaging hook in first 3 seconds
- Highlight key features and price
- Create urgency and excitement
- Natural conversational tone
- 30-45 seconds when spoken
- Use "and a half" for .5 numbers (e.g., "two and a half bathrooms")

Write only the script text, no stage directions.`

        const { text } = await generateText({
          model: openai("gpt-4o"),
          prompt,
          maxTokens: 300,
        })

        script = formatNumbersForSpeech(text.trim())
        method = "OpenAI"
      } catch (error) {
        console.warn("OpenAI failed, using template:", error)
      }
    }

    // Fallback template if OpenAI fails
    if (!script) {
      const bathroomText =
        Number(bathrooms) === 1
          ? "bathroom"
          : bathrooms.toString().includes(".5")
            ? `${bathrooms.replace(".5", " and a half")} bathrooms`
            : `${bathrooms} bathrooms`

      const bedroomText = Number(bedrooms) === 1 ? "bedroom" : `${bedrooms} bedrooms`

      script = `🏠 STUNNING ${bedroomText.toUpperCase()}, ${bathroomText.toUpperCase()} HOME! 

Located at ${expandedAddress}, this gorgeous ${Number(sqft).toLocaleString()} square foot property is priced at just $${Number(price).toLocaleString()}!

${propertyDescription ? `Featuring ${propertyDescription.toLowerCase()}, ` : ""}This home offers incredible value in today's market.

${bedroomText} and ${bathroomText} provide perfect space for your family. At ${Number(sqft).toLocaleString()} square feet, you'll have room to grow and thrive.

Don't wait - homes like this don't last long! Contact me today to schedule your private showing. This could be YOUR dream home! 

#RealEstate #DreamHome #ForSale #NewListing`

      script = formatNumbersForSpeech(script)
    }

    return NextResponse.json({ script, method })
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
