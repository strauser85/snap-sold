import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export const runtime = "nodejs"
export const maxDuration = 30

// Number to words conversion for natural speech
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
  const thousands = ["", "thousand", "million", "billion"]

  function convertHundreds(n: number): string {
    let result = ""

    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + " hundred"
      n %= 100
      if (n > 0) result += " "
    }

    if (n >= 20) {
      result += tens[Math.floor(n / 10)]
      n %= 10
      if (n > 0) result += "-" + ones[n]
    } else if (n >= 10) {
      result += teens[n - 10]
    } else if (n > 0) {
      result += ones[n]
    }

    return result
  }

  if (num < 1000) {
    return convertHundreds(num)
  }

  let result = ""
  let thousandIndex = 0

  while (num > 0) {
    const chunk = num % 1000
    if (chunk > 0) {
      const chunkWords = convertHundreds(chunk)
      if (thousandIndex > 0) {
        result = chunkWords + " " + thousands[thousandIndex] + (result ? " " + result : "")
      } else {
        result = chunkWords
      }
    }
    num = Math.floor(num / 1000)
    thousandIndex++
  }

  return result
}

// Convert address numbers to natural speech
function convertAddressToSpeech(address: string): string {
  return address.replace(/\b(\d+)\b/g, (match, number) => {
    const num = Number.parseInt(number)
    if (num < 10) return numberToWords(num)
    if (num < 100) return numberToWords(num)
    if (num < 1000) return numberToWords(num)

    // For 4-digit addresses like "2703", say "twenty-seven oh three"
    if (num >= 1000 && num <= 9999) {
      const thousands = Math.floor(num / 100)
      const remainder = num % 100
      if (remainder === 0) {
        return numberToWords(thousands) + " hundred"
      } else if (remainder < 10) {
        return numberToWords(thousands) + " oh " + numberToWords(remainder)
      } else {
        return numberToWords(thousands) + " " + numberToWords(remainder)
      }
    }

    return numberToWords(num)
  })
}

// Convert price to natural speech
function convertPriceToSpeech(price: number): string {
  if (price >= 1000000) {
    const millions = Math.floor(price / 1000000)
    const remainder = price % 1000000
    if (remainder === 0) {
      return numberToWords(millions) + " million dollars"
    } else {
      const thousands = Math.floor(remainder / 1000)
      if (thousands > 0) {
        return numberToWords(millions) + " million " + numberToWords(thousands) + " thousand dollars"
      } else {
        return numberToWords(millions) + " million dollars"
      }
    }
  } else if (price >= 1000) {
    const thousands = Math.floor(price / 1000)
    const remainder = price % 1000
    if (remainder === 0) {
      return numberToWords(thousands) + " thousand dollars"
    } else {
      return numberToWords(thousands) + " thousand " + numberToWords(remainder) + " dollars"
    }
  } else {
    return numberToWords(price) + " dollars"
  }
}

// Convert bedrooms/bathrooms to natural speech
function convertRoomsToSpeech(rooms: number, type: "bedroom" | "bathroom"): string {
  if (rooms === Math.floor(rooms)) {
    // Whole number
    const roomWord = rooms === 1 ? type : type + "s"
    return numberToWords(rooms) + " " + roomWord
  } else {
    // Half bathroom (e.g., 1.5, 2.5)
    const whole = Math.floor(rooms)
    const roomWord = rooms <= 1.5 ? type : type + "s"
    return numberToWords(whole) + " and a half " + roomWord
  }
}

export async function POST(request: NextRequest) {
  try {
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount } = await request.json()

    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return NextResponse.json({ error: "Missing required property details" }, { status: 400 })
    }

    // Remove ZIP code from address for speech (keep city, state)
    const addressParts = address.split(",")
    const streetAddress = addressParts[0]?.trim() || address
    const cityState = addressParts.slice(1, -1).join(",").trim() // Remove last part (ZIP)
    const speechAddress = convertAddressToSpeech(streetAddress)
    const locationForSpeech = cityState || "this beautiful location"

    // Convert numbers to natural speech
    const priceInWords = convertPriceToSpeech(price)
    const bedroomsInWords = convertRoomsToSpeech(bedrooms, "bedroom")
    const bathroomsInWords = convertRoomsToSpeech(bathrooms, "bathroom")
    const sqftInWords = numberToWords(sqft) + " square feet"

    // Extract key features from description
    const features = []
    if (propertyDescription) {
      const lowerDesc = propertyDescription.toLowerCase()
      if (lowerDesc.includes("detached shop")) features.push("detached shop")
      if (lowerDesc.includes("corner lot")) features.push("corner lot")
      if (lowerDesc.includes("pool")) features.push("pool")
      if (lowerDesc.includes("garage")) features.push("garage")
      if (lowerDesc.includes("fireplace")) features.push("fireplace")
      if (lowerDesc.includes("deck")) features.push("deck")
      if (lowerDesc.includes("patio")) features.push("patio")
      if (lowerDesc.includes("basement")) features.push("basement")
      if (lowerDesc.includes("walk-in closet")) features.push("walk-in closets")
    }

    const prompt = `Create a natural, engaging 35-second real estate video script for TikTok/Instagram Reels. Use this information:

Address: ${speechAddress}, ${locationForSpeech}
Price: ${priceInWords}
Bedrooms: ${bedroomsInWords}
Bathrooms: ${bathroomsInWords}
Square Footage: ${sqftInWords}
Key Features: ${features.length > 0 ? features.join(", ") : "Beautiful home"}
Images Available: ${imageCount}

REQUIREMENTS:
- Write for voiceover (natural speech, not reading)
- Use the EXACT address and price pronunciations provided above
- Target 35 seconds when spoken aloud
- Start with attention-grabbing hook
- Highlight key features naturally
- End with: "Schedule a showing today — message me to see it in person."
- Capitalize sentences properly
- No ZIP codes in speech
- No repetitive bed/bath mentions
- Clean, professional tone

Write ONLY the script text, no stage directions or formatting.`

    const { text: script } = await generateText({
      model: openai("gpt-4o"),
      prompt,
      system:
        "You are a professional real estate script writer. Create engaging, natural-sounding voiceover scripts that sound conversational when spoken aloud. Focus on benefits and lifestyle, not just features.",
    })

    // Clean up any remaining formatting issues
    const cleanScript = script
      .replace(/\b\d+br\b/gi, (match) => {
        const num = Number.parseInt(match)
        return convertRoomsToSpeech(num, "bedroom")
      })
      .replace(/\b\d+ba\b/gi, (match) => {
        const num = Number.parseFloat(match)
        return convertRoomsToSpeech(num, "bathroom")
      })
      .replace(/\bone\.\s*five\s*ba/gi, "one and a half bathroom")
      .replace(/\bone\.\s*bath/gi, "one bathroom")
      .replace(/\bthreebr\b/gi, "three bedroom")
      .replace(/\$(\d+)/g, (match, number) => {
        return convertPriceToSpeech(Number.parseInt(number))
      })
      .trim()

    return NextResponse.json({ script: cleanScript })
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json({ error: "Failed to generate script. Please try again." }, { status: 500 })
  }
}
