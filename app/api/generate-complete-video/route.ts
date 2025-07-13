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

// JavaScript sanitization function for ElevenLabs JSON safety
function sanitizeScript(text: string): string {
  return text
    .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII characters (emojis, corrupted UTF)
    .replace(/[""'']/g, '"') // Replace smart quotes
    .replace(/[\u2013\u2014]/g, "-") // Replace em/en dashes
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
}

// Comprehensive script sanitization for ElevenLabs API
function sanitizeScriptForElevenLabs(text: string): string {
  console.log("🧹 Starting comprehensive script sanitization for ElevenLabs...")

  // FIRST: Apply basic ASCII sanitization
  let sanitized = sanitizeScript(text)

  console.log("📝 After basic sanitization:", sanitized.length)

  // THEN: Apply additional ElevenLabs-specific cleaning
  sanitized = sanitized
    .replace(/\$(\d+)/g, "$1 dollars")
    .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
    .replace(/(\d+)\s*bed/gi, "$1 bedroom")
    .replace(/(\d+)\s*bath/gi, "$1 bathroom")
    .trim()

  // Ensure proper sentence ending
  if (sanitized && !/[.!?]$/.test(sanitized)) {
    sanitized += "."
  }

  console.log("✅ Final ElevenLabs sanitization complete")
  console.log("📝 Final length:", sanitized.length)
  console.log("🔍 Final sample:", sanitized.substring(0, 100) + "...")

  return sanitized
}

// Validate that text is proper UTF-8
function validateUTF8(text: string): boolean {
  try {
    // Try to encode and decode the text
    const encoded = new TextEncoder().encode(text)
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(encoded)
    return decoded === text
  } catch (error) {
    console.error("❌ UTF-8 validation failed:", error)
    return false
  }
}

// Generate ElevenLabs Rachel voiceover with sanitized input and proper JSON formatting
async function generateRachelVoiceWithWordTimestamps(script: string): Promise<{
  success: boolean
  audioUrl?: string
  error?: string
  wordTimings?: WordTiming[]
  duration?: number
  alignmentUsed?: boolean
  originalScript?: string
  sanitizedScript?: string
}> {
  try {
    console.log("🎤 Generating Rachel voiceover with sanitized script and word timestamps...")

    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured")
    }

    const apiKey = process.env.ELEVENLABS_API_KEY.trim()
    if (apiKey.length < 20) {
      throw new Error("ElevenLabs API key appears invalid")
    }

    // Step 1: Apply the sanitization function before ElevenLabs
    const cleanScript = sanitizeScript(script)

    // Log the cleaned script for verification
    console.log("🧹 SANITIZED SCRIPT FOR ELEVENLABS:")
    console.log("📝 Original length:", script.length)
    console.log("📝 Cleaned length:", cleanScript.length)
    console.log("🔍 Cleaned script:", cleanScript)

    // Step 2: Validate cleaned script
    if (cleanScript.length === 0) {
      throw new Error("Script is empty after sanitization")
    }

    if (cleanScript.length > 5000) {
      throw new Error("Script too long for ElevenLabs (max 5000 characters after sanitization)")
    }

    console.log("📝 Original script:", script.substring(0, 100) + "...")
    console.log("🧹 Sanitized script:", cleanScript.substring(0, 100) + "...")

    // Step 4: Prepare the request payload with cleaned script
    const requestPayload = {
      text: cleanScript, // Use sanitized script
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
    }

    console.log("📦 ElevenLabs payload prepared with cleaned script")
    console.log("🔍 Final payload text:", requestPayload.text)

    console.log("📦 Request payload prepared with sanitized text")
    console.log("🔍 Payload text sample:", requestPayload.text.substring(0, 50) + "...")

    // Step 5: Make API request with properly formatted JSON
    console.log("📡 Making ElevenLabs API request with JSON.stringify()...")
    console.log("🔍 RAW PAYLOAD BEFORE JSON.stringify():")
    console.log("   - text length:", requestPayload.text.length)
    console.log("   - text sample:", requestPayload.text.substring(0, 200))
    console.log("   - model_id:", requestPayload.model_id)
    console.log("   - voice_settings:", JSON.stringify(requestPayload.voice_settings))

    // Test JSON.stringify() before sending
    let jsonPayload: string
    try {
      jsonPayload = JSON.stringify(requestPayload)
      console.log("✅ JSON.stringify() successful - payload length:", jsonPayload.length)
      console.log("🔍 JSON payload sample:", jsonPayload.substring(0, 200))
    } catch (jsonError) {
      console.error("❌ JSON.stringify() FAILED:", jsonError)
      console.error("🔍 Problematic payload:", requestPayload)
      throw new Error(`JSON serialization failed: ${jsonError}`)
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: jsonPayload, // Use pre-tested JSON payload
    })

    console.log(`📡 ElevenLabs API response: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ ElevenLabs API error:", response.status, errorText)
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()

    // Step 6: Extract audio and alignment data from response
    if (!result.audio_base64) {
      throw new Error("No audio data in ElevenLabs response")
    }

    const audioDataUrl = `data:audio/mpeg;base64,${result.audio_base64}`

    // Step 7: Process word-level alignment data
    let wordTimings: WordTiming[] = []
    let alignmentUsed = false

    if (result.alignment && Array.isArray(result.alignment.words) && result.alignment.words.length > 0) {
      console.log("✅ Processing ElevenLabs word-level timestamps")

      // Map original script words to sanitized script alignment
      const originalWords = script.split(/\s+/).filter((word) => word.length > 0)

      wordTimings = result.alignment.words
        .map((wordData: any, index: number) => ({
          word: originalWords[index] || wordData.word || "", // Use original script word for display
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

    console.log("✅ Rachel voice generated successfully with sanitized script")
    console.log(`📊 ${wordTimings.length} words timed over ${totalDuration.toFixed(1)}s`)
    console.log(`🎯 Word-level alignment: ${alignmentUsed ? "Yes" : "No (fallback timing)"}`)

    return {
      success: true,
      audioUrl: audioDataUrl,
      wordTimings,
      duration: totalDuration,
      alignmentUsed,
      originalScript: script,
      sanitizedScript: cleanScript,
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
    console.log("🎬 COMPLETE VIDEO GENERATION WITH SANITIZED SCRIPT")

    const data: VideoRequest = await request.json()

    // Validation
    if (!data.address || !data.price || !data.script || !data.imageUrls || data.imageUrls.length === 0) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 })
    }

    console.log(`📍 Property: ${data.address}`)
    console.log(`🖼️ Images: ${data.imageUrls.length}`)
    console.log(`📝 Script: ${data.script.length} chars`)

    // Step 1: Generate Rachel voice with sanitized script and word timestamps
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
    console.log(
      `🎤 Rachel voice: 0.85x speed, sanitized script, word timestamps: ${audioResult.alignmentUsed ? "Yes" : "No"}`,
    )
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
        scriptSanitized: true,
        originalScriptLength: data.script.length,
        sanitizedScriptLength: audioResult.sanitizedScript?.length || 0,
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
