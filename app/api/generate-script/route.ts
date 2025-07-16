import { type NextRequest, NextResponse } from "next/server"

interface PropertyData {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription?: string
}

// FIXED: Better number-to-word conversion for natural speech
function numberToWords(num: number): string {
  if (num === 0) return "zero"
  if (num === 1) return "one"
  if (num === 2) return "two"
  if (num === 3) return "three"
  if (num === 4) return "four"
  if (num === 5) return "five"
  if (num === 6) return "six"
  if (num === 7) return "seven"
  if (num === 8) return "eight"
  if (num === 9) return "nine"
  if (num === 10) return "ten"
  return num.toString()
}

// FIXED: Better bathroom formatting for speech
function formatBathrooms(bathrooms: number): string {
  if (bathrooms === Math.floor(bathrooms)) {
    // Whole number
    return `${numberToWords(bathrooms)} bathroom${bathrooms !== 1 ? "s" : ""}`
  } else {
    // Decimal (like 1.5, 2.5, etc.)
    const whole = Math.floor(bathrooms)
    const decimal = bathrooms - whole

    if (decimal === 0.5) {
      if (whole === 0) {
        return "half bathroom"
      } else if (whole === 1) {
        return "one and a half bathrooms"
      } else {
        return `${numberToWords(whole)} and a half bathrooms`
      }
    }

    // Fallback for other decimals
    return `${bathrooms} bathrooms`
  }
}

// FIXED: Comprehensive script sanitization
function sanitizeScriptForSpeech(text: string): string {
  return (
    text
      // Fix smart quotes and special characters
      .replace(/[""'']/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII

      // Fix contractions for better speech
      .replace(/don't/gi, "do not")
      .replace(/won't/gi, "will not")
      .replace(/can't/gi, "cannot")
      .replace(/isn't/gi, "is not")
      .replace(/aren't/gi, "are not")
      .replace(/wasn't/gi, "was not")
      .replace(/weren't/gi, "were not")
      .replace(/haven't/gi, "have not")
      .replace(/hasn't/gi, "has not")
      .replace(/hadn't/gi, "had not")
      .replace(/wouldn't/gi, "would not")
      .replace(/shouldn't/gi, "should not")
      .replace(/couldn't/gi, "could not")

      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  )
}

export async function POST(request: NextRequest) {
  try {
    const data: PropertyData = await request.json()

    // Validation
    if (!data.address || !data.price) {
      return NextResponse.json({ error: "Address and price are required" }, { status: 400 })
    }

    // Format property details for natural speech
    const bedroomText = numberToWords(data.bedrooms)
    const bathroomText = formatBathrooms(data.bathrooms)
    const sqftText = data.sqft.toLocaleString()
    const priceText = data.price.toLocaleString()

    // Generate engaging script
    const scriptTemplate = `I have been in real estate for years, and this property still amazes me! I am excited to show you ${data.address}! You get ${bedroomText} bedrooms and ${bathroomText} in this spacious ${sqftText} square foot layout! The amazing features do not stop there! ${data.propertyDescription || `This beautiful ${bedroomText} bedroom home offers incredible value and comfort.`} Do not miss your chance to see this property. Schedule a showing today. Listed at $${priceText}, this property will not last long! And with ${data.bedrooms > 15 ? 30 : data.bedrooms + 15} stunning photos, you can see every amazing detail! This is your chance to own something special! Contact me immediately!`

    // FIXED: Apply comprehensive sanitization
    const sanitizedScript = sanitizeScriptForSpeech(scriptTemplate)

    console.log("✅ Script generated and sanitized successfully")
    console.log(`📝 Script length: ${sanitizedScript.length} characters`)

    return NextResponse.json({
      success: true,
      script: sanitizedScript,
      metadata: {
        originalLength: scriptTemplate.length,
        sanitizedLength: sanitizedScript.length,
        propertyDetails: {
          bedrooms: bedroomText,
          bathrooms: bathroomText,
          sqft: sqftText,
          price: priceText,
        },
      },
    })
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate script", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
