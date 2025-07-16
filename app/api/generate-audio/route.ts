import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 30

// Improve pronunciation for real estate terms
function improveScriptPronunciation(script: string): string {
  return (
    script
      // Handle addresses - break down numbers naturally
      .replace(/(\d{4,})/g, (match) => {
        const num = match
        if (num.length === 4) {
          // 2703 -> "twenty-seven oh three"
          const first = Number.parseInt(num.substring(0, 2))
          const second = Number.parseInt(num.substring(2))
          const firstWord =
            first < 20
              ? numberToWords(first)
              : numberToWords(Math.floor(first / 10) * 10) + (first % 10 ? " " + numberToWords(first % 10) : "")
          const secondWord = second < 10 ? "oh " + numberToWords(second) : numberToWords(second)
          return firstWord + " " + secondWord
        }
        return match
      })
      // Handle square footage
      .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
      .replace(/(\d+)\s*sqft/gi, "$1 square feet")
      // Handle bedrooms/bathrooms
      .replace(/(\d+)\s*bed/gi, "$1 bedroom")
      .replace(/(\d+)\s*bath/gi, "$1 bathroom")
      .replace(/(\d+)\s*br/gi, "$1 bedroom")
      .replace(/(\d+)\s*ba/gi, "$1 bathroom")
      // Handle prices
      .replace(/\$(\d+),?(\d{3}),?(\d{3})/g, "$$$1 million $2 thousand")
      .replace(/\$(\d+),?(\d{3})/g, "$$$1 thousand")
      .replace(/\$(\d+)/g, "$$$1 dollars")
      // Handle common abbreviations
      .replace(/\bst\b/gi, "street")
      .replace(/\bave\b/gi, "avenue")
      .replace(/\bdr\b/gi, "drive")
      .replace(/\brd\b/gi, "road")
      .replace(/\bblvd\b/gi, "boulevard")
      .replace(/\bct\b/gi, "court")
      .replace(/\bln\b/gi, "lane")
      // Clean up extra spaces
      .replace(/\s+/g, " ")
      .trim()
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

  return num.toString() // fallback for larger numbers
}

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json({ error: "Script is required" }, { status: 400 })
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

    // Improve pronunciation for real estate terms
    const improvedScript = improveScriptPronunciation(script)

    // Clean script for TTS
    const cleanScript = improvedScript
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: cleanScript,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.85,
          style: 0.4,
          use_speaker_boost: true,
        },
        output_format: "mp3_44100_128",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: `ElevenLabs API error: ${response.status} - ${errorText}` }, { status: 500 })
    }

    const audioBlob = await response.blob()
    if (audioBlob.size === 0) {
      return NextResponse.json({ error: "Empty audio response" }, { status: 500 })
    }

    // Convert to base64
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`

    // Estimate duration based on improved script
    const wordCount = cleanScript.split(" ").length
    const estimatedDuration = Math.max(15, Math.ceil((wordCount / 140) * 60)) // Slightly slower for natural speech

    return NextResponse.json({
      success: true,
      audioUrl,
      duration: estimatedDuration,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Audio generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
