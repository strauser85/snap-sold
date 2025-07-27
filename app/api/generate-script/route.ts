import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

// Helper function to convert numbers to natural speech
function formatNumberForSpeech(num: string): string {
  const number = Number.parseInt(num)

  // Handle addresses like "38261" -> "thirty-eight two sixty-one"
  if (num.length === 5) {
    const first = Math.floor(number / 1000)
    const last = number % 1000
    if (first < 100 && last < 1000) {
      return `${numberToWords(first)} ${numberToWords(last)}`
    }
  }

  // Handle regular numbers
  if (number < 1000) {
    return numberToWords(number)
  } else if (number < 1000000) {
    const thousands = Math.floor(number / 1000)
    const remainder = number % 1000
    if (remainder === 0) {
      return `${numberToWords(thousands)} thousand`
    } else {
      return `${numberToWords(thousands)} thousand ${numberToWords(remainder)}`
    }
  }

  return num // fallback
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
        {
          error: "Missing required property details",
        },
        { status: 400 },
      )
    }

    // Clean address for speech (remove ZIP code)
    const cleanAddress = address.replace(/\s+\d{5}(-\d{4})?$/, "")

    // Format numbers for natural speech
    const addressForSpeech = cleanAddress.replace(/\d+/g, (match: string) => formatNumberForSpeech(match))
    const priceForSpeech = `${formatNumberForSpeech(price)} dollars`
    const bedroomsForSpeech = `${bedrooms} ${bedrooms === "1" ? "bedroom" : "bedrooms"}`
    const bathroomsForSpeech = bathrooms.includes(".5")
      ? `${bathrooms.replace(".5", " and a half")} bathrooms`
      : `${bathrooms} ${bathrooms === "1" ? "bathroom" : "bathrooms"}`
    const sqftForSpeech = `${formatNumberForSpeech(sqft)} square feet`

    // Remove duplicate bedroom/bathroom info from description
    let cleanDescription = propertyDescription || ""
    cleanDescription = cleanDescription.replace(/\d+\s*(br|bed|bedroom|bedrooms?)/gi, "")
    cleanDescription = cleanDescription.replace(/\d+\.?\d*\s*(ba|bath|bathroom|bathrooms?)/gi, "")
    cleanDescription = cleanDescription.replace(/\$?\d+k?/gi, "") // Remove price mentions
    cleanDescription = cleanDescription.replace(/\s+/g, " ").trim()

    // Generate clean, engaging script
    let script = `Check out this incredible property at ${addressForSpeech}! `
    script += `This stunning home features ${bedroomsForSpeech}, ${bathroomsForSpeech}, and ${sqftForSpeech} of living space. `

    if (cleanDescription) {
      script += `${cleanDescription} `
    }

    script += `And the best part? It's priced at just ${priceForSpeech}. `
    script += `This won't last long in today's market. Schedule your showing today!`

    // Clean up any formatting issues
    script = script.replace(/\s+/g, " ") // Remove extra spaces
    script = script.replace(/\.\s*\./g, ".") // Remove double periods
    script = script.trim()

    return NextResponse.json({
      success: true,
      script: script,
    })
  } catch (error) {
    console.error("Script generation error:", error)

    return NextResponse.json(
      {
        error: "Failed to generate script. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
