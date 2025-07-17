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

// Convert numbers to natural speech for TTS voiceover
function formatNumbersForVoiceover(text: string): string {
  return (
    text
      // Handle addresses and zip codes (2703 → "twenty-seven oh three", 38261 → "three eight two six one")
      .replace(/\b(\d{4,5})\b/g, (match, num) => {
        const digits = num.split("")
        if (digits.length === 4) {
          // 4-digit numbers like 2703
          const first = Number.parseInt(digits[0] + digits[1])
          const second = Number.parseInt(digits[2] + digits[3])
          if (second < 10) {
            return `${numberToWords(first)} oh ${numberToWords(second)}`
          } else {
            return `${numberToWords(first)} ${numberToWords(second)}`
          }
        } else if (digits.length === 5) {
          // 5-digit zip codes like 38261
          return digits.map((d) => numberToWords(Number.parseInt(d))).join(" ")
        }
        return match
      })

      // Handle prices with commas (235,000 → "two hundred thirty-five thousand dollars")
      .replace(/\$?(\d{1,3}(?:,\d{3})*)/g, (match, num) => {
        const cleanNum = num.replace(/,/g, "")
        const numValue = Number.parseInt(cleanNum)
        const words = numberToWords(numValue)

        if (match.startsWith("$")) {
          return `${words} dollars`
        }
        return words
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

      // Handle regular numbers without decimals
      .replace(/\b(\d+)\b/g, (match, num) => {
        const numValue = Number.parseInt(num)
        if (numValue > 0 && numValue < 1000000) {
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

function cleanScriptForVoiceover(script: string): string {
  return (
    script
      // Remove redundant phrases
      .replace(/\b(\d+)\s+(bedroom|bath)\w*\s+home\b/gi, (match, num, type) => {
        return `${type}${type.endsWith("h") ? "" : "room"} home`
      })

      // Fix awkward phrasing like "three bedrooms home"
      .replace(/(\w+)\s+bedrooms?\s+home/gi, "$1-bedroom home")
      .replace(/(\w+)\s+bathrooms?\s+home/gi, "$1-bathroom home")

      // Remove sentence fragments and standalone numbers
      .replace(/\.\s*\d+\s*\./g, ".")
      .replace(/\s+\d+\s+/g, " ")

      // Clean up multiple spaces and periods
      .replace(/\s+/g, " ")
      .replace(/\.+/g, ".")
      .replace(/\s*\.\s*/g, ". ")

      // Ensure proper sentence structure
      .replace(/([.!?])\s*([a-z])/g, "$1 $2")

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
      // Start with the user's description as the foundation
      script = propertyDescription.trim()

      // Add location if not mentioned
      if (!script.toLowerCase().includes(address.toLowerCase().split(",")[0])) {
        script = `Located at ${expandedAddress}, this property features ${script.toLowerCase()}`
      }

      // Add key details only if not already mentioned
      const bedroomText = numBedrooms === 1 ? "bedroom" : "bedrooms"
      const bathroomText = numBathrooms === 1 ? "bathroom" : "bathrooms"

      if (!script.toLowerCase().includes("bedroom") && !script.toLowerCase().includes("bed")) {
        script += ` This ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} home`
      }

      if (!script.toLowerCase().includes("square") && !script.toLowerCase().includes("sq")) {
        script += ` offers ${numSqft.toLocaleString()} square feet of living space`
      }

      if (
        !script.toLowerCase().includes("price") &&
        !script.includes("$") &&
        !script.toLowerCase().includes("dollar")
      ) {
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
        script = `Discover this exceptional ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} residence featuring ${numSqft.toLocaleString()} square feet of refined living space. Located at ${expandedAddress}, this property is offered at $${numPrice.toLocaleString()}.`
      } else if (tone === "family") {
        script = `Welcome to this wonderful ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} family home with ${numSqft.toLocaleString()} square feet of comfortable living space. Perfectly located at ${expandedAddress} and priced at $${numPrice.toLocaleString()}.`
      } else if (tone === "affordable") {
        script = `Great opportunity! This ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} home offers ${numSqft.toLocaleString()} square feet of living space at an excellent value. Located at ${expandedAddress} for just $${numPrice.toLocaleString()}.`
      } else {
        script = `This well-appointed ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} home features ${numSqft.toLocaleString()} square feet of thoughtfully designed living space. Located at ${expandedAddress} and priced at $${numPrice.toLocaleString()}.`
      }
    }

    // Add single, clear call-to-action based on tone
    if (tone === "luxury") {
      script += " Contact me today to schedule your private showing."
    } else if (tone === "family") {
      script += " Call now to schedule a showing for your family."
    } else if (tone === "affordable") {
      script += " Don't wait - call now to schedule a showing."
    } else {
      script += " Call now to schedule a showing."
    }

    // Clean script for voiceover and format numbers
    const cleanedScript = cleanScriptForVoiceover(script)
    const voiceoverScript = formatNumbersForVoiceover(cleanedScript)

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
    const fallbackScript = "Beautiful property available for showing. Call now to schedule a viewing."

    return NextResponse.json({
      script: fallbackScript,
      originalScript: fallbackScript,
      tone: "professional",
      fallback: true,
    })
  }
}
