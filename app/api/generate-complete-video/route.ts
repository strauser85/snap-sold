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

// Comprehensive script sanitization for ElevenLabs API
function sanitizeScriptForElevenLabs(text: string): string {
  console.log("🧹 Starting script sanitization for ElevenLabs...")
  console.log("📝 Original script length:", text.length)

  let sanitized = text

  // Step 1: Remove all emojis and Unicode symbols
  // This regex removes all emoji characters, symbols, and pictographs
  sanitized = sanitized.replace(/[\u{1F600}-\u{1F64F}]/gu, "") // Emoticons
  sanitized = sanitized.replace(/[\u{1F300}-\u{1F5FF}]/gu, "") // Misc Symbols and Pictographs
  sanitized = sanitized.replace(/[\u{1F680}-\u{1F6FF}]/gu, "") // Transport and Map
  sanitized = sanitized.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "") // Regional indicator symbols
  sanitized = sanitized.replace(/[\u{2600}-\u{26FF}]/gu, "") // Misc symbols
  sanitized = sanitized.replace(/[\u{2700}-\u{27BF}]/gu, "") // Dingbats
  sanitized = sanitized.replace(/[\u{1F900}-\u{1F9FF}]/gu, "") // Supplemental Symbols and Pictographs
  sanitized = sanitized.replace(/[\u{1FA70}-\u{1FAFF}]/gu, "") // Symbols and Pictographs Extended-A

  // Step 2: Replace smart quotes and punctuation with ASCII equivalents
  sanitized = sanitized.replace(/[""]/g, '"') // Smart double quotes
  sanitized = sanitized.replace(/['']/g, "'") // Smart single quotes
  sanitized = sanitized.replace(/[–—]/g, "-") // Em dash, en dash
  sanitized = sanitized.replace(/[…]/g, "...") // Ellipsis
  sanitized = sanitized.replace(/[«»]/g, '"') // Guillemets
  sanitized = sanitized.replace(/[‚„]/g, ",") // Various comma-like characters

  // Step 3: Remove or replace special characters that could break TTS
  sanitized = sanitized.replace(/[®©™]/g, "") // Trademark symbols
  sanitized = sanitized.replace(/[°]/g, " degrees ") // Degree symbol
  sanitized = sanitized.replace(/[±]/g, " plus or minus ") // Plus-minus
  sanitized = sanitized.replace(/[×]/g, " times ") // Multiplication
  sanitized = sanitized.replace(/[÷]/g, " divided by ") // Division
  sanitized = sanitized.replace(/[¼]/g, " one quarter ") // Fractions
  sanitized = sanitized.replace(/[½]/g, " one half ")
  sanitized = sanitized.replace(/[¾]/g, " three quarters ")

  // Step 4: Handle currency and numbers properly
  sanitized = sanitized.replace(/\$/g, " dollars ") // Dollar signs
  sanitized = sanitized.replace(/[¢]/g, " cents ") // Cents
  sanitized = sanitized.replace(/[£]/g, " pounds ") // British pounds
  sanitized = sanitized.replace(/[€]/g, " euros ") // Euros
  sanitized = sanitized.replace(/[¥]/g, " yen ") // Yen

  // Step 5: Remove remaining non-ASCII characters
  // Keep only basic ASCII characters (32-126) plus common accented letters
  sanitized = sanitized.replace(/[^\x20-\x7E\u00C0-\u00FF]/g, " ")

  // Step 6: Clean up real estate abbreviations for better pronunciation
  sanitized = sanitized.replace(/\bsq\.?\s*ft\.?\b/gi, "square feet")
  sanitized = sanitized.replace(/\bsqft\b/gi, "square feet")
  sanitized = sanitized.replace(/\bbr\.?\b/gi, "bedrooms")
  sanitized = sanitized.replace(/\bba\.?\b/gi, "bathrooms")
  sanitized = sanitized.replace(/\bbeds?\b/gi, "bedrooms")
  sanitized = sanitized.replace(/\bbaths?\b/gi, "bathrooms")
  sanitized = sanitized.replace(/\bst\.?\b/gi, "street")
  sanitized = sanitized.replace(/\bave\.?\b/gi, "avenue")
  sanitized = sanitized.replace(/\brd\.?\b/gi, "road")
  sanitized = sanitized.replace(/\bdr\.?\b/gi, "drive")
  sanitized = sanitized.replace(/\bblvd\.?\b/gi, "boulevard")

  // Step 7: Handle numbers and measurements
  sanitized = sanitized.replace(/(\d+),(\d+)/g, "$1$2") // Remove commas from numbers
  sanitized = sanitized.replace(/\b(\d+)k\b/gi, "$1 thousand") // 250k -> 250 thousand
  sanitized = sanitized.replace(/\b(\d+)m\b/gi, "$1 million") // 2m -> 2 million

  // Step 8: Clean up punctuation and spacing
  sanitized = sanitized.replace(/[^\w\s.,!?'-]/g, " ") // Remove remaining special chars
  sanitized = sanitized.replace(/\s+/g, " ") // Normalize whitespace
  sanitized = sanitized.replace(/\s+([.,!?])/g, "$1") // Fix spacing before punctuation
  sanitized = sanitized.replace(/([.,!?])\s*([.,!?])/g, "$1 $2") // Fix multiple punctuation

  // Step 9: Ensure proper sentence structure
  sanitized = sanitized.replace(/\.([A-Za-z])/g, ". $1") // Space after periods
  sanitized = sanitized.replace(/!([A-Za-z])/g, "! $1") // Space after exclamations
  sanitized = sanitized.replace(/\?([A-Za-z])/g, "? $1") // Space after questions

  // Step 10: Final cleanup
  sanitized = sanitized.trim()

  // Ensure the text ends with proper punctuation for natural speech
  if (sanitized && !/[.!?]$/.test(sanitized)) {
    sanitized += "."
  }

  console.log("✅ Script sanitization complete")
  console.log("📝 Sanitized script length:", sanitized.length)
  console.log("🔍 Sample sanitized text:", sanitized.substring(0, 100) + "...")

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

    // Step 1: Sanitize the script for ElevenLabs
    const sanitizedScript = sanitizeScriptForElevenLabs(script)

    // Step 2: Validate UTF-8 encoding
    if (!validateUTF8(sanitizedScript)) {
      throw new Error("Script contains invalid UTF-8 characters after sanitization")
    }

    // Step 3: Validate script length
    if (sanitizedScript.length === 0) {
      throw new Error("Script is empty after sanitization")
    }

    if (sanitizedScript.length > 5000) {
      throw new Error("Script too long for ElevenLabs (max 5000 characters after sanitization)")
    }

    console.log("📝 Original script:", script.substring(0, 100) + "...")
    console.log("🧹 Sanitized script:", sanitizedScript.substring(0, 100) + "...")

    // Step 4: Prepare the request payload with proper JSON formatting
    const requestPayload = {
      text: sanitizedScript, // Use sanitized script
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

    console.log("📦 Request payload prepared with sanitized text")
    console.log("🔍 Payload text sample:", requestPayload.text.substring(0, 50) + "...")

    // Step 5: Make API request with properly formatted JSON
    console.log("📡 Making ElevenLabs API request with JSON.stringify()...")

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        Accept: "application/json", // Request JSON response for timestamps
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(requestPayload), // Properly stringify the payload
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
      wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].endTime + 1 : estimateDuration(sanitizedScript)

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
      sanitizedScript: sanitizedScript,
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
