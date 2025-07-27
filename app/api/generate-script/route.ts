import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

// Convert numbers to natural speech for addresses
function formatAddressNumber(num: string): string {
  // For addresses like "38261", break into groups: "thirty-eight two sixty-one"
  if (num.length === 5) {
    const first = Number.parseInt(num.substring(0, 2))
    const second = Number.parseInt(num.substring(2, 3))
    const third = Number.parseInt(num.substring(3, 5))

    const firstWords = numberToWords(first)
    const secondWords = numberToWords(second)
    const thirdWords = numberToWords(third)

    return `${firstWords} ${secondWords} ${thirdWords}`
  } else if (num.length === 4) {
    const first = Number.parseInt(num.substring(0, 2))
    const second = Number.parseInt(num.substring(2, 4))
    return `${numberToWords(first)} ${numberToWords(second)}`
  } else {
    return numberToWords(Number.parseInt(num))
  }
}

// Convert numbers to words
function numberToWords(num: number): string {
  if (num === 0) return "zero"
  if (num < 0) return "negative " + numberToWords(-num)

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

  function convertHundreds(n: number): string {
    let result = ""

    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + " hundred"
      n %= 100
      if (n > 0) result += " "
    }

    if (n >= 20) {
      result += tens[Math.floor(n / 10)]
      if (n % 10 > 0) result += "-" + ones[n % 10]
    } else if (n >= 10) {
      result += teens[n - 10]
    } else if (n > 0) {
      result += ones[n]
    }

    return result
  }

  if (num < 1000) {
    return convertHundreds(num)
  } else if (num < 1000000) {
    const thousands = Math.floor(num / 1000)
    const remainder = num % 1000
    let result = convertHundreds(thousands) + " thousand"
    if (remainder > 0) {
      result += " " + convertHundreds(remainder)
    }
    return result
  } else {
    const millions = Math.floor(num / 1000000)
    const remainder = num % 1000000
    let result = convertHundreds(millions) + " million"
    if (remainder > 0) {
      if (remainder >= 1000) {
        const thousands = Math.floor(remainder / 1000)
        result += " " + convertHundreds(thousands) + " thousand"
        const finalRemainder = remainder % 1000
        if (finalRemainder > 0) {
          result += " " + convertHundreds(finalRemainder)
        }
      } else {
        result += " " + convertHundreds(remainder)
      }
    }
    return result
  }
}

// Format price for natural speech
function formatPrice(price: number): string {
  return numberToWords(price) + " dollars"
}

// Format bathrooms with half-bath support
function formatBathrooms(bathrooms: number): string {
  if (bathrooms === Math.floor(bathrooms)) {
    const word = bathrooms === 1 ? "bathroom" : "bathrooms"
    return numberToWords(bathrooms) + " " + word
  } else {
    const whole = Math.floor(bathrooms)
    const word = bathrooms <= 1.5 ? "bathroom" : "bathrooms"
    if (whole === 0) {
      return "one half bathroom"
    } else {
      return numberToWords(whole) + " and a half " + word
    }
  }
}

// Format bedrooms
function formatBedrooms(bedrooms: number): string {
  const word = bedrooms === 1 ? "bedroom" : "bedrooms"
  return numberToWords(bedrooms) + " " + word
}

// Format square footage
function formatSquareFeet(sqft: number): string {
  return numberToWords(sqft) + " square feet"
}

// Clean address for speech
function cleanAddressForSpeech(address: string): string {
  // Remove ZIP codes and format address numbers properly
  let cleanAddress = address.replace(/\b\d{5}(-\d{4})?\b/g, "")

  // Format address numbers (like house numbers)
  cleanAddress = cleanAddress.replace(/\b(\d{4,5})\b/g, (match) => {
    return formatAddressNumber(match)
  })

  return cleanAddress.replace(/,\s*,/g, ",").replace(/,\s*$/g, "").trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription } = body

    // Validate required fields
    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return NextResponse.json({ error: "Missing required property details" }, { status: 400 })
    }

    // Convert inputs to numbers
    const numPrice = Number(price)
    const numBedrooms = Number(bedrooms)
    const numBathrooms = Number(bathrooms)
    const numSqft = Number(sqft)

    // Validate numeric inputs
    if (isNaN(numPrice) || isNaN(numBedrooms) || isNaN(numBathrooms) || isNaN(numSqft)) {
      return NextResponse.json({ error: "Invalid numeric values" }, { status: 400 })
    }

    // Clean address for speech
    const speechAddress = cleanAddressForSpeech(address)

    // Convert to natural speech
    const priceText = formatPrice(numPrice)
    const bedroomsText = formatBedrooms(numBedrooms)
    const bathroomsText = formatBathrooms(numBathrooms)
    const sqftText = formatSquareFeet(numSqft)

    // Build clean, engaging script
    let script = ""

    // Opening hook
    script += `Welcome to this stunning property at ${speechAddress}! `

    // Core features - avoid repetition
    script += `This beautiful home offers ${bedroomsText} and ${bathroomsText}, `
    script += `with ${sqftText} of gorgeous living space. `

    // Integrate user description smoothly
    if (propertyDescription && propertyDescription.trim()) {
      const cleanDescription = propertyDescription.trim()

      // Remove redundant info to avoid duplication
      const filteredDescription = cleanDescription
        .replace(/\d+\s*(bed|bedroom|br)\w*/gi, "")
        .replace(/\d+\.?\d*\s*(bath|bathroom|ba)\w*/gi, "")
        .replace(/\d+\s*(sq\s*ft|square\s*feet)\w*/gi, "")
        .replace(/\$[\d,]+/g, "")
        .replace(/\s+/g, " ")
        .trim()

      if (filteredDescription) {
        script += `You'll love the ${filteredDescription.toLowerCase()}. `
      }
    }

    // Price reveal
    script += `And the best part? It's priced at just ${priceText}! `

    // Call to action
    script += `This incredible home won't last long. Message me today to schedule your private showing!`

    // Clean up formatting
    const finalScript = script
      .replace(/\s+/g, " ")
      .replace(/\.\s*\./g, ".")
      .replace(/!\s*!/g, "!")
      .trim()

    return NextResponse.json({
      script: finalScript,
      wordCount: finalScript.split(" ").length,
      estimatedDuration: Math.round((finalScript.split(" ").length / 150) * 60),
    })
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json({ error: "Failed to generate script. Please try again." }, { status: 500 })
  }
}
