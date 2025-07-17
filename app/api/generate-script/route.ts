import { type NextRequest, NextResponse } from "next/server"

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

function formatNumberForSpeech(num: number): string {
  if (num === Math.floor(num)) {
    return num.toString()
  }

  const parts = num.toString().split(".")
  const whole = Number.parseInt(parts[0])
  const decimal = parts[1]

  if (decimal === "5") {
    return `${whole} and a half`
  }

  return num.toString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount } = body

    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const expandedAddress = expandStreetAbbreviations(address)
    const bedroomText = formatNumberForSpeech(Number(bedrooms))
    const bathroomText = formatNumberForSpeech(Number(bathrooms))
    const priceFormatted = Number(price).toLocaleString()
    const sqftFormatted = Number(sqft).toLocaleString()

    let script = ""
    let method = "Template"

    // Try OpenAI first if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content:
                  "You are a professional real estate marketing expert. Create engaging, viral TikTok scripts for property listings. Keep scripts under 60 seconds when spoken. Use natural, conversational language that builds excitement and urgency.",
              },
              {
                role: "user",
                content: `Create a TikTok script for this property:
Address: ${expandedAddress}
Price: $${priceFormatted}
Bedrooms: ${bedroomText}
Bathrooms: ${bathroomText}
Square Feet: ${sqftFormatted}
Description: ${propertyDescription || "Beautiful home"}
Images: ${imageCount} photos

Make it exciting and viral-worthy. Use natural speech patterns. When saying numbers like 1.5, say "one and a half".`,
              },
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        })

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json()
          script = openaiData.choices[0]?.message?.content || ""
          method = "OpenAI"
        }
      } catch (openaiError) {
        console.warn("OpenAI failed, using template:", openaiError)
      }
    }

    // Fallback to template if OpenAI failed or no API key
    if (!script) {
      const features = propertyDescription
        ? propertyDescription
            .split(/[,.!;]/)
            .slice(0, 2)
            .map((f) => f.trim())
            .filter((f) => f.length > 0)
        : []

      script = `🏠 STUNNING ${bedroomText.toUpperCase()} BEDROOM HOME ALERT! 

Located at ${expandedAddress}, this incredible property is priced at just $${priceFormatted}!

✨ Here's what makes this home special:
• ${bedroomText} spacious bedrooms
• ${bathroomText} beautiful bathrooms  
• ${sqftFormatted} square feet of living space
${features.length > 0 ? `• ${features.join("\n• ")}` : ""}

This won't last long at this price! Properties like this in this area are selling FAST. 

💰 At $${priceFormatted}, you're getting incredible value for ${sqftFormatted} square feet.

Ready to see it? Comment "INFO" below or DM me now! 

#RealEstate #HomeSweetHome #PropertyTour #DreamHome #RealEstateAgent`
    }

    return NextResponse.json({
      script: script.trim(),
      method,
      expandedAddress,
      formattedNumbers: {
        bedrooms: bedroomText,
        bathrooms: bathroomText,
        price: priceFormatted,
        sqft: sqftFormatted,
      },
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
