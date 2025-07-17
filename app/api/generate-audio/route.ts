import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json()

    if (!script) {
      return NextResponse.json({ error: "No script provided" }, { status: 400 })
    }

    // Convert numbers to natural speech
    const naturalScript = script
      .replace(/\b1\.5\b/g, "one and a half")
      .replace(/\b2\.5\b/g, "two and a half")
      .replace(/\b(\d+)\.5\b/g, (match: string, num: string) => {
        const number = Number.parseInt(num)
        const words = numberToWords(number)
        return `${words} and a half`
      })
      .replace(/\$(\d{1,3}(?:,\d{3})*)/g, (match: string, amount: string) => {
        const num = Number.parseInt(amount.replace(/,/g, ""))
        return `$${numberToWords(num)} dollars`
      })
      .replace(/\b(\d{4,})\b/g, (match: string) => {
        const num = Number.parseInt(match)
        return numberToWords(num)
      })

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text: naturalScript,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" })

    // Upload audio to blob storage
    const { put } = await import("@vercel/blob")
    const blob = await put(`audio-${Date.now()}.mp3`, audioBlob, {
      access: "public",
    })

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = naturalScript.split(" ").length
    const estimatedDuration = Math.max(10, (wordCount / 150) * 60)

    return NextResponse.json({
      audioUrl: blob.url,
      duration: estimatedDuration,
    })
  } catch (error) {
    console.error("Audio generation error:", error)
    return NextResponse.json({ error: "Audio generation failed" }, { status: 500 })
  }
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

  return num.toString() // fallback for very large numbers
}
