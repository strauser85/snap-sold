import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

// Configure body parser
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
}

// Convert numbers to natural speech with context awareness
function formatNumberForSpeech(num: string, context: "address" | "price" | "general" = "general"): string {
  const number = parseInt(num)

  if (context === "address") {
    // For addresses like "2703" -> "twenty-seven-oh-three"
    if (num.length === 4) {
      const first = Math.floor(number / 100)
      const last = number % 100
      if (last < 10) {
        return `${numberToWords(first)}-oh-${numberToWords(last)}`
      } else {
        return `${numberToWords(first)}-${numberToWords(last)}`
      }
    }
    // For addresses like "38261" -> "thirty-eight-two-sixty-one"
    if (num.length === 5) {
      const first = Math.floor(number / 1000)
      const last = number % 1000
      return `${numberToWords(first)}-${numberToWords(Math.floor(last / 100))}-${numberToWords(last % 100)}`
    }
  }

  if (context === "price") {
    // For prices, use full number words
    if (number >= 1000000) {
      const millions = Math.floor(number / 1000000)
      const remainder = number % 1000000
      if (remainder === 0) {
        return `${numberToWords(millions)} million dollars`
      } else {
        const thousands = Math.floor(remainder / 1000)
        return `${numberToWords(millions)} million ${numberToWords(thousands)} thousand dollars`
      }
    } else if (number >= 1000) {
      const thousands = Math.floor(number / 1000)
      const remainder = number % 1000
      if (remainder === 0) {
        return `${numberToWords(thousands)} thousand dollars`
      } else {
        return `${numberToWords(thousands)} thousand ${numberToWords(remainder)} dollars`
      }
    }
    return `${numberToWords(number)} dollars`
  }

  return numberToWords(number)
}

function numberToWords(num: number): string {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

  if (num === 0) return "zero"
  if (num < 10) return ones[num]
  if (num < 20) return teens[num - 10]
  if (num < 100) {
    const ten = Math.floor(num / 10)
    const one = num % 10
    return tens[ten] + (one > 0 ? "-" + ones[one] : "")
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100)
    const remainder = num % 100
    return ones[hundred] + " hundred" + (remainder > 0 ? " " + numberToWords(remainder) : "")
  }

  return num.toString()
}

export async function POST(request: NextRequest) {
  try {
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription } = await request.json()

    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return NextResponse.json(
        { error: "Missing required property details" },
        { status: 400 }
      )
    }

    // Clean address for speech (remove ZIP code)
    const cleanAddress = address.replace(/\s+\d{5}(-\d{4})?$/, "")

    // Format numbers for natural speech with context
    const addressForSpeech = cleanAddress.replace(/\d+/g, (match: string) => formatNumberForSpeech(match, "address"))
    const priceForSpeech = formatNumberForSpeech(price, "price")
    
    // Handle bedroom/bathroom abbreviations
    const bedroomsForSpeech = `${bedrooms} ${bedrooms === "1" ? "bedroom" : "bedrooms"}`
    const bathroomsForSpeech = bathrooms.includes(".5")
      ? `${bathrooms.replace(".5", " and a half")} bathrooms`
      : `${bathrooms} ${bathrooms === "1" ? "bathroom" : "bathrooms"}`
    const sqftForSpeech = `${formatNumberForSpeech(sqft)} square feet`

    let script = ""

    // Use user-provided description first, fallback to template if none given
    if (propertyDescription && propertyDescription.trim()) {
      // Clean user description - remove duplicate bedroom/bathroom info
      let cleanDescription = propertyDescription.trim()
      cleanDescription = cleanDescription.replace(/\d+\s*(br|bed|bedroom|bedrooms?)/gi, "")
      cleanDescription = cleanDescription.replace(/\d+\.?\d*\s*(ba|bath|bathroom|bathrooms?)/gi, "")
      cleanDescription = cleanDescription.replace(/\$?\d+k?/gi, "") // Remove price mentions
      cleanDescription = cleanDescription.replace(/\s+/g, " ").trim()

      // Build script with user description first
      script = `Welcome to this incredible property at ${addressForSpeech}! ${cleanDescription} `
      script += `This home features ${bedroomsForSpeech}, ${bathroomsForSpeech}, and ${sqftForSpeech} of living space. `
      script += `Priced at ${priceForSpeech}. Schedule your showing today!`
    } else {
      // Fallback template if no description provided
      script = `Check out this stunning property at ${addressForSpeech}! `
      script += `This beautiful home features ${bedroomsForSpeech}, ${bathroomsForSpeech}, and ${sqftForSpeech} of living space. `
      script += `Priced at just ${priceForSpeech}. This won't last long - schedule your showing today!`
    }

    // Clean up formatting
    script = script.replace(/\s+/g, " ").replace(/\.\s*\./g, ".").trim()

    return NextResponse.json({
      success: true,
      script: script,
    })
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate script. Please try again." },
      { status: 500 }
    )
  }
}
