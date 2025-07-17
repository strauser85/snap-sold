import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

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

// Remove ZIP codes from spoken address - keep city/state only
function sanitizeAddressForSpeech(address: string): string {
  // Remove ZIP codes (5 digits or 5+4 format)
  const withoutZip = address.replace(/\b\d{5}(-\d{4})?\b/g, "").trim()

  // Clean up extra commas and spaces
  return withoutZip.replace(/,\s*,/g, ",").replace(/,\s*$/g, "").trim()
}

// Convert numbers to natural speech for TTS voiceover
function formatNumbersForVoiceover(text: string): string {
  return (
    text
      // Handle addresses (2703 → "twenty-seven oh three")
      .replace(/\b(\d{4})\b/g, (match, num) => {
        const digits = num.split("")
        const first = Number.parseInt(digits[0] + digits[1])
        const second = Number.parseInt(digits[2] + digits[3])
        if (second < 10) {
          return `${numberToWords(first)} oh ${numberToWords(second)}`
        } else {
          return `${numberToWords(first)} ${numberToWords(second)}`
        }
      })

      // Handle prices with commas (235,000 → "two hundred thirty-five thousand dollars")
      .replace(/\$(\d{1,3}(?:,\d{3})*)/g, (match, num) => {
        const cleanNum = num.replace(/,/g, "")
        const numValue = Number.parseInt(cleanNum)
        return `${numberToWords(numValue)} dollars`
      })

      // Handle square footage (1,066 → "one thousand sixty-six")
      .replace(/(\d{1,3}(?:,\d{3})*)\s*(square feet|sq ft|sqft)/gi, (match, num, unit) => {
        const cleanNum = num.replace(/,/g, "")
        const numValue = Number.parseInt(cleanNum)
        return `${numberToWords(numValue)} square feet`
      })

      // Handle bathrooms (1.5 → "one and a half")
      .replace(/(\d+)\.5\s*(bathroom|bath)/gi, (match, num, unit) => {
        return `${numberToWords(Number.parseInt(num))} and a half ${unit}s`
      })

      // Handle regular decimals (1.5 → "one and a half")
      .replace(/(\d+)\.5/g, (match, num) => {
        return `${numberToWords(Number.parseInt(num))} and a half`
      })

      // Handle whole numbers
      .replace(/\b(\d+)\b/g, (match, num) => {
        const numValue = Number.parseInt(num)
        if (numValue > 0 && numValue <= 100) {
          return numberToWords(numValue)
        }
        return match
      })
  )
}

function numberToWords(num: number): string {
  if (num === 0) return "zero"

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

  if (num < 10) return ones[num]
  if (num < 20) return teens[num - 10]
  if (num < 100) {
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "")
  }
  if (num < 1000) {
    return ones[Math.floor(num / 100)] + " hundred" + (num % 100 ? " " + numberToWords(num % 100) : "")
  }
  if (num < 1000000) {
    return numberToWords(Math.floor(num / 1000)) + " thousand" + (num % 1000 ? " " + numberToWords(num % 1000) : "")
  }

  return num.toString() // Fallback for very large numbers
}

// Normalize abbreviations and fix malformed tokens
function normalizePropertyTerms(text: string): string {
  return (
    text
      // Fix malformed tokens
      .replace(/\bthreebr\b/gi, "three bedroom")
      .replace(/\bone\.\s*fiveba\b/gi, "one and a half bathroom")
      .replace(/\bone\.\s*bath\b/gi, "one bathroom")
      .replace(/\btwo\.\s*bath\b/gi, "two bathroom")
      .replace(/\bthree\.\s*bath\b/gi, "three bathroom")

      // Normalize abbreviations
      .replace(/(\d+)\s*BR\b/gi, "$1 bedroom")
      .replace(/(\d+)\s*BA\b/gi, "$1 bathroom")
      .replace(/(\d+)\.5\s*BA\b/gi, "$1 and a half bathroom")
      .replace(/\bSQ\s*FT\b/gi, "square feet")
      .replace(/\bSQFT\b/gi, "square feet")

      // Fix plural forms
      .replace(/(\d+)\s+bedroom(?!s)/gi, (match, num) => {
        return Number.parseInt(num) === 1 ? `${num} bedroom` : `${num} bedrooms`
      })
      .replace(/(\d+)\s+bathroom(?!s)/gi, (match, num) => {
        return Number.parseInt(num) === 1 ? `${num} bathroom` : `${num} bathrooms`
      })

      // Clean up spacing
      .replace(/\s+/g, " ")
      .trim()
  )
}

// Clean script for voiceover and remove redundancy
function sanitizeScriptForVoiceover(script: string): string {
  return (
    script
      // Capitalize sentences
      .replace(/(^|\.\s+)([a-z])/g, (match, prefix, letter) => prefix + letter.toUpperCase())

      // Remove redundant bed/bath mentions
      .replace(/(\d+\s+bedrooms?)[^.]*(\d+\s+bedrooms?)/gi, "$1")
      .replace(/(\d+\s+bathrooms?)[^.]*(\d+\s+bathrooms?)/gi, "$1")

      // Fix sentence structure
      .replace(/\.\s*\./g, ".")
      .replace(/\s+/g, " ")
      .replace(/,\s*,/g, ",")

      .trim()
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount } = body

    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return NextResponse.json({ error: "Missing required property details" }, { status: 400 })
    }

    const expandedAddress = expandStreetAbbreviations(address)
    const speechAddress = sanitizeAddressForSpeech(expandedAddress)
    const numPrice = Number(price)
    const numBedrooms = Number(bedrooms)
    const numBathrooms = Number(bathrooms)
    const numSqft = Number(sqft)

    // Determine property tone based on price and description
    let tone = "professional"
    if (numPrice >= 800000) tone = "luxury"
    else if (numPrice <= 300000) tone = "affordable"
    else if (propertyDescription?.toLowerCase().includes("family") || numBedrooms >= 3) tone = "family"

    let script = ""

    // Use property description as the base, inject structured data cleanly
    if (propertyDescription && propertyDescription.trim().length > 10) {
      // Start with normalized description
      const baseDescription = normalizePropertyTerms(propertyDescription.trim())

      // Check if description already mentions key details
      const hasBedrooms = /\d+\s+(bedroom|bed)/i.test(baseDescription)
      const hasBathrooms = /\d+\s+(bathroom|bath)/i.test(baseDescription)
      const hasSquareFootage = /(square feet|sq ft|sqft)/i.test(baseDescription)
      const hasPrice = /\$|dollar|price/i.test(baseDescription)

      // Build script starting with description
      script = baseDescription

      // Add location if not mentioned
      if (!script.toLowerCase().includes(speechAddress.toLowerCase().split(",")[0])) {
        script = `Located at ${speechAddress}, this property features ${script.toLowerCase()}`
      }

      // Add missing key details without redundancy
      const bedroomText = numBedrooms === 1 ? "bedroom" : "bedrooms"
      const bathroomText = numBathrooms === 1 ? "bathroom" : "bathrooms"

      if (!hasBedrooms && !hasBathrooms) {
        script += ` This ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} home`
      } else if (!hasBedrooms) {
        script += ` with ${numBedrooms} ${bedroomText}`
      } else if (!hasBathrooms) {
        script += ` and ${numBathrooms} ${bathroomText}`
      }

      if (!hasSquareFootage) {
        script += ` offers ${numSqft.toLocaleString()} square feet of living space`
      }

      if (!hasPrice) {
        if (tone === "luxury") {
          script += ` and is priced at $${numPrice.toLocaleString()}`
        } else {
          script += ` for $${numPrice.toLocaleString()}`
        }
      }

      script += "."
    } else {
      // Fallback script if no description provided
      const bedroomText = numBedrooms === 1 ? "bedroom" : "bedrooms"
      const bathroomText = numBathrooms === 1 ? "bathroom" : "bathrooms"

      if (tone === "luxury") {
        script = `Discover this exceptional ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} residence featuring ${numSqft.toLocaleString()} square feet of refined living space. Located at ${speechAddress}, this property is offered at $${numPrice.toLocaleString()}.`
      } else if (tone === "family") {
        script = `Welcome to this wonderful ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} family home with ${numSqft.toLocaleString()} square feet of comfortable living space. Perfectly located at ${speechAddress} and priced at $${numPrice.toLocaleString()}.`
      } else if (tone === "affordable") {
        script = `Great opportunity! This ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} home offers ${numSqft.toLocaleString()} square feet of living space at an excellent value. Located at ${speechAddress} for just $${numPrice.toLocaleString()}.`
      } else {
        script = `This well-appointed ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} home features ${numSqft.toLocaleString()} square feet of thoughtfully designed living space. Located at ${speechAddress} and priced at $${numPrice.toLocaleString()}.`
      }
    }

    // Add single, clear call-to-action
    script += " Schedule a showing today — message me to see it in person."

    // Clean and format script for voiceover
    const sanitizedScript = sanitizeScriptForVoiceover(script)
    const voiceoverScript = formatNumbersForVoiceover(sanitizedScript)

    return NextResponse.json({
      script: voiceoverScript,
      originalScript: script,
      tone: tone,
      wordCount: voiceoverScript.split(" ").length,
      estimatedDuration: Math.round((voiceoverScript.split(" ").length / 150) * 60), // ~150 words per minute
    })
  } catch (error) {
    console.error("Script generation error:", error)

    // Fallback script generation
    const fallbackScript =
      "Beautiful property available for showing. Schedule a showing today — message me to see it in person."

    return NextResponse.json({
      script: fallbackScript,
      originalScript: fallbackScript,
      tone: "professional",
      fallback: true,
    })
  }
}
