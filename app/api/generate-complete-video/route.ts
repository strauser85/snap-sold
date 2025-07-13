import { type NextRequest, NextResponse } from "next/server"

interface VideoRequest {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription?: string
  script: string
  imageUrls: string[]
}

interface WordTiming {
  word: string
  startTime: number
  endTime: number
}

// Comprehensive text cleaning for natural TTS speech
function cleanTextForVoice(text: string): string {
  let cleaned = text

  // Step 1: Preserve important patterns we don't want to change
  const preservePatterns: { [key: string]: string } = {}
  let preserveCounter = 0

  // Preserve prices (e.g., $250,000, $1.5M, $2.3 million)
  cleaned = cleaned.replace(/\$[\d,]+(?:\.[\d]+)?[KMB]?(?:\s*(?:million|thousand|billion))?/gi, (match) => {
    const placeholder = `__PRESERVE_PRICE_${preserveCounter++}__`
    preservePatterns[placeholder] = match
    return placeholder
  })

  // Preserve street numbers and addresses (e.g., 123 Main St, 4567 Oak Ave)
  cleaned = cleaned.replace(
    /\b\d+\s+[A-Za-z]+\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Ct|Court|Pl|Place|Way|Circle|Cir)\b/gi,
    (match) => {
      const placeholder = `__PRESERVE_ADDRESS_${preserveCounter++}__`
      preservePatterns[placeholder] = match
      return placeholder
    },
  )

  // Preserve square footage numbers (e.g., 2,500 sq ft, 1500 sqft)
  cleaned = cleaned.replace(/\b[\d,]+\s*(?:sq\s*ft|sqft|square\s+feet)\b/gi, (match) => {
    const placeholder = `__PRESERVE_SQFT_${preserveCounter++}__`
    preservePatterns[placeholder] = match
    return placeholder
  })

  // Step 2: Convert decimals to spoken form
  // Handle decimals like 2.5 → "two and a half", 1.5 → "one and a half"
  cleaned = cleaned.replace(/\b(\d+)\.5\b/g, (match, whole) => {
    const wholeNum = Number.parseInt(whole)
    const wholeWord = numberToWords(wholeNum)
    return `${wholeWord} and a half`
  })

  // Handle other decimals like 3.2 → "three point two"
  cleaned = cleaned.replace(/\b(\d+)\.(\d+)\b/g, (match, whole, decimal) => {
    const wholeWord = numberToWords(Number.parseInt(whole))
    const decimalDigits = decimal
      .split("")
      .map((d) => numberToWords(Number.parseInt(d)))
      .join(" ")
    return `${wholeWord} point ${decimalDigits}`
  })

  // Step 3: Convert numbers 1-10 to words (but not in preserved patterns)
  cleaned = cleaned.replace(/\b([1-9]|10)\b/g, (match) => {
    return numberToWords(Number.parseInt(match))
  })

  // Step 4: Replace real estate abbreviations
  cleaned = cleaned.replace(/\bBR\b/gi, "bedrooms")
  cleaned = cleaned.replace(/\bBA\b/gi, "bathrooms")
  cleaned = cleaned.replace(/\bbeds?\b/gi, "bedrooms")
  cleaned = cleaned.replace(/\bbaths?\b/gi, "bathrooms")

  // Step 5: Fix punctuation spacing
  // Add space after periods if missing
  cleaned = cleaned.replace(/\.([A-Za-z])/g, ". $1")
  // Add space after commas if missing
  cleaned = cleaned.replace(/,([A-Za-z])/g, ", $1")
  // Add space after exclamation marks if missing
  cleaned = cleaned.replace(/!([A-Za-z])/g, "! $1")
  // Add space after question marks if missing
  cleaned = cleaned.replace(/\?([A-Za-z])/g, "? $1")

  // Step 6: Remove or replace problematic characters for TTS
  // Remove emojis and special symbols
  cleaned = cleaned.replace(/[🏠🚨💰📱✨🔥⚡💎📈🏃‍♂️💨📞🎵♪]/gu, "")
  // Replace bullet points with "and"
  cleaned = cleaned.replace(/[•·]/g, "and")
  // Replace & with "and"
  cleaned = cleaned.replace(/&/g, "and")
  // Remove hashtags
  cleaned = cleaned.replace(/#\w+/g, "")
  // Remove @ mentions
  cleaned = cleaned.replace(/@\w+/g, "")

  // Step 7: Clean up multiple spaces and normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim()

  // Step 8: Restore preserved patterns
  Object.keys(preservePatterns).forEach((placeholder) => {
    cleaned = cleaned.replace(placeholder, preservePatterns[placeholder])
  })

  return cleaned
}

// Helper function to convert numbers to words
function numberToWords(num: number): string {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]

  if (num >= 0 && num <= 10) {
    return ones[num]
  }

  // For numbers > 10, return as string (we only convert 1-10)
  return num.toString()
}

// Generate ElevenLabs Rachel voiceover with precise word-level timestamps
async function generateRachelVoiceWithWordTimestamps(script: string): Promise<{
  success: boolean
  audioUrl?: string
  error?: string
  wordTimings?: WordTiming[]
  duration?: number
  alignmentUsed?: boolean
  originalScript?: string
  cleanedScript?: string
}> {
  try {
    console.log("🎤 Generating Rachel voiceover with precise word timestamps...")

    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured")
    }

    const apiKey = process.env.ELEVENLABS_API_KEY.trim()
    if (apiKey.length < 20) {
      throw new Error("ElevenLabs API key appears invalid")
    }

    // Clean script specifically for natural TTS speech
    const voiceOptimizedScript = cleanTextForVoice(script)
    console.log("📝 Original script:", script.substring(0, 100) + "...")
    console.log("🎙️ Voice-optimized script:", voiceOptimizedScript.substring(0, 100) + "...")

    // Basic cleanup for TTS processing (remove remaining problematic chars)
    const cleanScript = voiceOptimizedScript
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    // Generate audio with word-level timestamps using ElevenLabs
    console.log("🎵 Generating Rachel audio with word-level timestamps...")

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        Accept: "application/json", // Changed to JSON to get timestamps
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: cleanScript, // Use voice-optimized script for TTS
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.85,
          style: 0.25,
          use_speaker_boost: true,
          speaking_rate: 0.85, // 85% speed for better readability
        },
        output_format: "mp3_44100_128",
        enable_logging: false,
        timestamps: "word", // Enable word-level timestamps
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()

    // Extract audio and alignment data from response
    if (!result.audio_base64) {
      throw new Error("No audio data in ElevenLabs response")
    }

    const audioDataUrl = `data:audio/mpeg;base64,${result.audio_base64}`

    // Process word-level alignment data
    let wordTimings: WordTiming[] = []
    let alignmentUsed = false

    if (result.alignment && Array.isArray(result.alignment.words) && result.alignment.words.length > 0) {
      console.log("✅ Processing ElevenLabs word-level timestamps")

      // Map original script words to cleaned script alignment
      const originalWords = script.split(/\s+/).filter((word) => word.length > 0)

      wordTimings = result.alignment.words
        .map((wordData: any, index: number) => ({
          word: originalWords[index] || wordData.word || "", // Use original script word
          startTime: wordData.start_time_seconds || 0,
          endTime: wordData.end_time_seconds || 0,
        }))
        .filter((timing: WordTiming) => timing.word.length > 0)

      alignmentUsed = true
      console.log(`✅ Processed ${wordTimings.length} word timestamps from ElevenLabs`)
    } else {
      console.warn("⚠️ No word timestamps from ElevenLabs - using fallback timing")
      wordTimings = generateFallbackWordTimings(
        script.split(/\s+/).filter((w) => w.length > 0),
        0,
      )
    }

    const totalDuration =
      wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].endTime + 1 : estimateDuration(cleanScript)

    console.log("✅ Rachel voice generated successfully with word timestamps")
    console.log(`📊 ${wordTimings.length} words timed over ${totalDuration.toFixed(1)}s`)
    console.log(`🎯 Word-level alignment: ${alignmentUsed ? "Yes" : "No (fallback timing)"}`)

    return {
      success: true,
      audioUrl: audioDataUrl,
      wordTimings,
      duration: totalDuration,
      alignmentUsed,
      originalScript: script,
      cleanedScript: voiceOptimizedScript,
    }
  } catch (error) {
    console.error("❌ Rachel voice generation failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Voice generation failed",
      alignmentUsed: false,
      originalScript: script,
    }
  }
}

// Fallback word timing estimation
function generateFallbackWordTimings(words: string[], startTime = 0): WordTiming[] {
  const wordTimings: WordTiming[] = []
  let currentTime = startTime + 0.3 // Start with small delay

  // Adjust for 0.85x speed
  const baseWordsPerSecond = 2.0 * 0.85 // 85% speed adjustment

  words.forEach((word, index) => {
    // Adjust timing based on word characteristics
    let wordDuration = 0.4 // Base duration per word

    // Longer words take more time
    if (word.length > 6) wordDuration += 0.2
    if (word.length > 10) wordDuration += 0.3

    // Punctuation adds pause
    if (word.includes(",")) wordDuration += 0.1
    if (word.includes(".") || word.includes("!") || word.includes("?")) wordDuration += 0.3

    // Numbers and special terms take longer
    if (/\d/.test(word)) wordDuration += 0.2
    if (word.toLowerCase().includes("bedroom") || word.toLowerCase().includes("bathroom")) wordDuration += 0.1

    // Apply 0.85x speed adjustment
    wordDuration = wordDuration / 0.85

    wordTimings.push({
      word: word,
      startTime: currentTime,
      endTime: currentTime + wordDuration,
    })

    currentTime += wordDuration + 0.05 // Small gap between words
  })

  return wordTimings
}

// Estimate total duration for 0.85x speed
function estimateDuration(script: string): number {
  const wordCount = script.split(/\s+/).length
  // Adjust for 0.85x speed (slower = longer duration)
  return Math.max(35, (wordCount / (150 * 0.85)) * 60)
}

// Generate word-based captions using precise ElevenLabs word timestamps
function generatePreciseWordCaptions(
  wordTimings: WordTiming[],
  totalDuration: number,
): Array<{
  text: string
  words: WordTiming[]
  startTime: number
  endTime: number
}> {
  const captions: Array<{ text: string; words: WordTiming[]; startTime: number; endTime: number }> = []

  if (!wordTimings || wordTimings.length === 0) {
    console.warn("⚠️ No word timings available for caption generation")
    return captions
  }

  const wordsPerCaption = 3 // TikTok-style short chunks

  for (let i = 0; i < wordTimings.length; i += wordsPerCaption) {
    const captionWords = wordTimings.slice(i, i + wordsPerCaption)

    if (captionWords.length > 0) {
      captions.push({
        text: captionWords
          .map((w) => w.word)
          .join(" ")
          .toUpperCase(),
        words: captionWords,
        startTime: captionWords[0].startTime, // Exact ElevenLabs timing
        endTime: captionWords[captionWords.length - 1].endTime, // Exact ElevenLabs timing
      })
    }
  }

  console.log(`✅ Generated ${captions.length} precise word-based captions`)
  return captions
}

// Generate sentence-level captions as fallback using estimated timing
function generateSentenceCaptions(
  originalScript: string,
  totalDuration: number,
): Array<{
  text: string
  words: WordTiming[]
  startTime: number
  endTime: number
}> {
  console.log("📝 Generating sentence-level captions with estimated timing")

  const sentences = originalScript
    .replace(/[^\w\s.,!?'-]/g, " ")
    .replace(/\s+/g, " ")
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim().toUpperCase())

  const captions: Array<{ text: string; words: WordTiming[]; startTime: number; endTime: number }> = []

  if (sentences.length === 0) return captions

  const timePerSentence = totalDuration / sentences.length

  sentences.forEach((sentence, index) => {
    const startTime = index * timePerSentence
    const endTime = startTime + timePerSentence - 0.2

    const words = sentence.split(/\s+/).map((word, wordIndex) => ({
      word,
      startTime: startTime + wordIndex * 0.3,
      endTime: startTime + wordIndex * 0.3 + 0.3,
    }))

    captions.push({
      text: sentence,
      words,
      startTime,
      endTime: Math.min(endTime, totalDuration),
    })
  })

  console.log(`✅ Generated ${captions.length} sentence-level captions with estimated timing`)
  return captions
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 COMPLETE VIDEO GENERATION WITH PRECISE WORD TIMESTAMPS")

    const data: VideoRequest = await request.json()

    // Validation
    if (!data.address || !data.price || !data.script || !data.imageUrls || data.imageUrls.length === 0) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 })
    }

    console.log(`📍 Property: ${data.address}`)
    console.log(`🖼️ Images: ${data.imageUrls.length}`)
    console.log(`📝 Script: ${data.script.length} chars`)

    // Step 1: Generate Rachel voice with precise word timestamps
    const audioResult = await generateRachelVoiceWithWordTimestamps(data.script)
    if (!audioResult.success) {
      return NextResponse.json({ error: `Voice generation failed: ${audioResult.error}` }, { status: 500 })
    }

    // Step 2: Calculate video timing
    const totalDuration = audioResult.duration || estimateDuration(data.script)
    const timePerImage = Math.max(3, Math.floor(totalDuration / data.imageUrls.length))

    // Step 3: Generate captions with precise timing
    let captions: Array<{ text: string; words: WordTiming[]; startTime: number; endTime: number }>

    if (audioResult.wordTimings && audioResult.wordTimings.length > 0 && audioResult.alignmentUsed) {
      console.log("✅ Using precise word-based captions from ElevenLabs timestamps")
      captions = generatePreciseWordCaptions(audioResult.wordTimings, totalDuration)
    } else {
      console.log("⚠️ Falling back to sentence-level captions with estimated timing")
      captions = generateSentenceCaptions(data.script, totalDuration)
    }

    console.log(`📊 Video: ${totalDuration.toFixed(1)}s duration, ${timePerImage}s per image`)
    console.log(`🎤 Rachel voice: 0.85x speed, word timestamps: ${audioResult.alignmentUsed ? "Yes" : "No"}`)
    console.log(`📝 Captions: ${captions.length} chunks with precise timing`)

    // Return everything needed for client-side video generation
    return NextResponse.json({
      success: true,
      audioUrl: audioResult.audioUrl,
      images: data.imageUrls,
      duration: totalDuration,
      timePerImage,
      wordTimings: audioResult.wordTimings,
      captions,
      property: {
        address: data.address,
        price: data.price,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        sqft: data.sqft,
      },
      format: {
        width: 576,
        height: 1024,
        fps: 30,
      },
      voiceSettings: {
        speed: 0.85,
        natural: true,
        wordSynced: audioResult.alignmentUsed || false,
        alignmentUsed: audioResult.alignmentUsed || false,
        description: `Rachel voice at 0.85x speed${audioResult.alignmentUsed ? " with precise word timestamps" : " with estimated timing"}`,
      },
      metadata: {
        alignmentUsed: audioResult.alignmentUsed || false,
        captionDelay: 0, // No artificial delay - using precise timestamps
        captionType: audioResult.alignmentUsed ? "word-precise" : "sentence-estimated",
      },
    })
  } catch (error) {
    console.error("❌ Complete video generation failed:", error)
    return NextResponse.json(
      { error: "Video generation failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
