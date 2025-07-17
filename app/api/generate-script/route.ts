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

// Convert numbers to natural speech for voiceover
function convertNumbersToSpeech(text: string): string {
  return (
    text
      // Handle decimal numbers like 1.5, 2.5, etc.
      .replace(/(\d+)\.5/g, (match, num) => `${num} and a half`)
      .replace(/(\d+)\.25/g, (match, num) => `${num} and a quarter`)
      .replace(/(\d+)\.75/g, (match, num) => `${num} and three quarters`)

      // Handle 4-digit numbers like addresses (2703 → "twenty-seven oh three")
      .replace(/\b(\d{4})\b/g, (match, num) => {
        const thousands = Math.floor(Number.parseInt(num) / 1000)
        const remainder = Number.parseInt(num) % 1000
        if (remainder < 100) {
          return `${numberToWords(thousands)} oh ${numberToWords(remainder)}`
        } else {
          return `${numberToWords(thousands)} ${numberToWords(remainder)}`
        }
      })

      // Handle large numbers with commas (235,000 → "two hundred thirty-five thousand")
      .replace(/\$?(\d{1,3}(?:,\d{3})*)/g, (match, num) => {
        const cleanNum = num.replace(/,/g, "")
        const numValue = Number.parseInt(cleanNum)
        if (match.startsWith("$")) {
          return `$${numberToWords(numValue)} dollars`
        }
        return numberToWords(numValue)
      })
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

  if (num === 0) return "zero"
  if (num < 10) return ones[num]
  if (num < 20) return teens[num - 10]
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "")
  if (num < 1000) return ones[Math.floor(num / 100)] + " hundred" + (num % 100 ? " " + numberToWords(num % 100) : "")
  if (num < 1000000)
    return numberToWords(Math.floor(num / 1000)) + " thousand" + (num % 1000 ? " " + numberToWords(num % 1000) : "")

  return num.toString() // Fallback for very large numbers
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

    // Determine property tone based on price
    let tone = "professional"
    if (numPrice >= 800000) tone = "luxury"
    else if (numPrice <= 300000) tone = "affordable"
    else if (propertyDescription?.toLowerCase().includes("family") || numBedrooms >= 3) tone = "family"

    // Create professional script based on property description as core
    let script = ""

    if (propertyDescription) {
      // Use property description as the foundation
      script = `${propertyDescription.trim()}`

      // Add key details naturally without redundancy
      const bedroomText = numBedrooms === 1 ? "bedroom" : "bedrooms"
      const bathroomText = numBathrooms === 1 ? "bathroom" : "bathrooms"

      if (!script.toLowerCase().includes("bedroom")) {
        script += ` This ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} home`
      }

      if (!script.toLowerCase().includes("square") && sqft) {
        script += ` offers ${numSqft} square feet of living space`
      }

      if (!script.toLowerCase().includes("price") && !script.includes("$")) {
        if (tone === "luxury") {
          script += ` and is priced at ${numPrice.toLocaleString()} dollars`
        } else {
          script += ` for just ${numPrice.toLocaleString()} dollars`
        }
      }

      script += ` located at ${expandedAddress}.`
    } else {
      // Fallback if no description provided
      const bedroomText = numBedrooms === 1 ? "bedroom" : "bedrooms"
      const bathroomText = numBathrooms === 1 ? "bathroom" : "bathrooms"

      if (tone === "luxury") {
        script = `Discover this exceptional ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} residence featuring ${numSqft} square feet of refined living space. Located at ${expandedAddress}, this property is offered at ${numPrice.toLocaleString()} dollars.`
      } else if (tone === "family") {
        script = `Welcome to this wonderful ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} family home with ${numSqft} square feet of comfortable living space. Perfectly located at ${expandedAddress} and priced at ${numPrice.toLocaleString()} dollars.`
      } else if (tone === "affordable") {
        script = `Great opportunity! This ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} home offers ${numSqft} square feet of living space at an excellent value. Located at ${expandedAddress} for just ${numPrice.toLocaleString()} dollars.`
      } else {
        script = `This well-appointed ${numBedrooms} ${bedroomText}, ${numBathrooms} ${bathroomText} home features ${numSqft} square feet of thoughtfully designed living space. Located at ${expandedAddress} and priced at ${numPrice.toLocaleString()} dollars.`
      }
    }

    // Add appropriate call-to-action based on tone
    if (tone === "luxury") {
      script += " Schedule a private showing today."
    } else if (tone === "family") {
      script += " Perfect for growing families. Schedule a showing today."
    } else if (tone === "affordable") {
      script += " Don't miss this opportunity. Call now to schedule a showing."
    } else {
      script += " Contact me today to schedule a showing."
    }

    // Convert numbers to natural speech for voiceover
    const voiceoverScript = convertNumbersToSpeech(script)

    return NextResponse.json({
      script: voiceoverScript,
      originalScript: script,
      tone: tone,
    })
  } catch (error) {
    console.error("Script generation error:", error)

    // Fallback script generation
    const fallbackScript = "Beautiful property available for showing. Contact me today for more information."

    return NextResponse.json({
      script: fallbackScript,
      originalScript: fallbackScript,
      tone: "professional",
      fallback: true,
    })
  }
}
