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

// Generate ElevenLabs Rachel voiceover with voice-optimized text cleaning
async function generateRachelVoiceWithTiming(script: string): Promise<{
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
    console.log("🎤 Generating Rachel voiceover at 0.85x speed with voice-optimized text...")

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

    // Try to get alignment data with bulletproof error handling
    let alignmentData: any = null
    let alignmentUsed = false

    try {
      console.log("🔍 Attempting to get word alignment from ElevenLabs...")

      const alignmentResponse = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/with-timestamps",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text: cleanScript,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.85,
              style: 0.25,
              use_speaker_boost: true,
              speaking_rate: 0.85, // 85% speed for better clarity
            },
            output_format: "mp3_44100_128",
            apply_text_normalization: "auto",
          }),
        },
      )

      if (alignmentResponse.ok) {
        const alignmentResult = await alignmentResponse.json()

        // Bulletproof validation of alignment response structure
        if (
          alignmentResult &&
          typeof alignmentResult === "object" &&
          alignmentResult.hasOwnProperty("alignment") &&
          Array.isArray(alignmentResult.alignment) &&
          alignmentResult.alignment.length > 0
        ) {
          // Additional validation - check if alignment items have required properties
          const hasValidItems = alignmentResult.alignment.some(
            (item: any) =>
              item &&
              typeof item === "object" &&
              item.hasOwnProperty("character") &&
              item.hasOwnProperty("start_time_seconds") &&
              item.hasOwnProperty("end_time_seconds"),
          )

          if (hasValidItems) {
            alignmentData = alignmentResult
            alignmentUsed = true
            console.log("✅ Got valid alignment data from ElevenLabs")
            console.log(`📊 Alignment contains ${alignmentResult.alignment.length} timing points`)
          } else {
            console.warn("⚠️ No alignment data from ElevenLabs - alignment items missing required properties")
          }
        } else {
          console.warn("⚠️ No alignment data from ElevenLabs - response structure invalid")
        }
      } else {
        console.warn(`⚠️ No alignment data from ElevenLabs - API returned ${alignmentResponse.status}`)
      }
    } catch (alignmentError) {
      console.warn("⚠️ No alignment data from ElevenLabs - API call failed:", alignmentError)
      console.log("Continuing with fallback timing estimation...")
    }

    // Generate the actual audio with voice-optimized script at 0.85x speed
    console.log("🎵 Generating Rachel audio with voice-optimized text at 0.85x speed...")

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
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
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
    }

    const audioBlob = await response.blob()
    if (audioBlob.size === 0) {
      throw new Error("Empty audio response")
    }

    // Convert to data URL
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

    // Generate word timings with safe alignment handling (use original script for caption mapping)
    const wordTimings = generateWordTimings(script, alignmentData, alignmentUsed) // Use original script
    const totalDuration =
      wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].endTime + 1 : estimateDuration(cleanScript)

    console.log("✅ Rachel voice generated successfully with voice-optimized text")
    console.log(`📊 ${wordTimings.length} words timed over ${totalDuration.toFixed(1)}s`)
    console.log(`🎯 Alignment used: ${alignmentUsed ? "Yes" : "No (fallback timing)"}`)

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

// Generate word-level timing data with bulletproof alignment handling
function generateWordTimings(script: string, alignmentData?: any, alignmentUsed?: boolean): WordTiming[] {
  const words = script.split(/\s+/).filter((word) => word.length > 0)
  const wordTimings: WordTiming[] = []

  // Bulletproof alignment check
  if (
    alignmentUsed &&
    alignmentData &&
    typeof alignmentData === "object" &&
    alignmentData.alignment &&
    Array.isArray(alignmentData.alignment) &&
    alignmentData.alignment.length > 0
  ) {
    try {
      console.log("🎯 Using ElevenLabs alignment data for precise timing")

      // Process alignment data with extra safety checks
      let wordIndex = 0
      let currentWord = ""

      // Safe forEach with additional validation
      alignmentData.alignment.forEach((item: any, index: number) => {
        // Multiple safety checks for each alignment item
        if (
          item &&
          typeof item === "object" &&
          item.hasOwnProperty("character") &&
          item.hasOwnProperty("start_time_seconds") &&
          item.hasOwnProperty("end_time_seconds") &&
          typeof item.start_time_seconds === "number" &&
          typeof item.end_time_seconds === "number"
        ) {
          const char = String(item.character || "")
          const startTime = Math.max(0, item.start_time_seconds)
          const endTime = Math.max(startTime + 0.1, item.end_time_seconds)

          if (char && char.trim()) {
            currentWord += char

            // Check if we've completed a word (space or end of alignment)
            if (char === " " || index === alignmentData.alignment.length - 1) {
              if (currentWord.trim() && wordIndex < words.length) {
                wordTimings.push({
                  word: currentWord.trim(),
                  startTime,
                  endTime,
                })
                wordIndex++
              }
              currentWord = ""
            }
          }
        }
      })

      console.log(`✅ Processed ${wordTimings.length} words from alignment data`)

      // If we didn't get all words from alignment, fall back for remaining
      if (wordTimings.length < words.length) {
        console.warn(
          `⚠️ Alignment only covered ${wordTimings.length}/${words.length} words, using fallback for remaining`,
        )
        const remainingWords = words.slice(wordTimings.length)
        const lastEndTime = wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].endTime : 0

        const fallbackTimings = generateFallbackWordTimings(remainingWords, lastEndTime)
        wordTimings.push(...fallbackTimings)
      }
    } catch (alignmentError) {
      console.error("❌ Error processing alignment data:", alignmentError)
      console.warn("⚠️ No alignment data from ElevenLabs - falling back to estimated timing")
      return generateFallbackWordTimings(words, 0)
    }
  } else {
    console.warn("⚠️ No alignment data from ElevenLabs - using fallback word timing estimation")
    return generateFallbackWordTimings(words, 0)
  }

  return wordTimings
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

// Generate sentence-level captions as fallback with 500ms delay (using original script)
function generateSentenceCaptions(
  originalScript: string,
  totalDuration: number,
): Array<{
  text: string
  words: WordTiming[]
  startTime: number
  endTime: number
}> {
  console.log("📝 Generating sentence-level captions with 500ms delay using original script")

  // Split into sentences using original script for captions
  const sentences = originalScript
    .replace(/[^\w\s.,!?'-]/g, " ")
    .replace(/\s+/g, " ")
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim().toUpperCase())

  const captions: Array<{ text: string; words: WordTiming[]; startTime: number; endTime: number }> = []

  if (sentences.length === 0) return captions

  const CAPTION_DELAY = 0.5 // 500ms delay
  const availableDuration = totalDuration - CAPTION_DELAY
  const timePerSentence = availableDuration / sentences.length

  sentences.forEach((sentence, index) => {
    const startTime = CAPTION_DELAY + index * timePerSentence
    const endTime = startTime + timePerSentence - 0.2 // Small gap between sentences

    // Create dummy word timings for sentence
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

  console.log(`✅ Generated ${captions.length} sentence-level captions from original script`)
  return captions
}

// Generate word-based captions with 500ms delay
function generateWordBasedCaptions(
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

  const CAPTION_DELAY = 0.5 // 500ms delay
  const wordsPerCaption = 4 // Smaller chunks for better readability

  for (let i = 0; i < wordTimings.length; i += wordsPerCaption) {
    const captionWords = wordTimings.slice(i, i + wordsPerCaption)

    if (captionWords.length > 0) {
      captions.push({
        text: captionWords
          .map((w) => w.word)
          .join(" ")
          .toUpperCase(),
        words: captionWords,
        startTime: Math.max(0, captionWords[0].startTime + CAPTION_DELAY),
        endTime: Math.min(totalDuration, captionWords[captionWords.length - 1].endTime + CAPTION_DELAY),
      })
    }
  }

  console.log(`✅ Generated ${captions.length} word-based captions with 500ms delay`)
  return captions
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 COMPLETE VIDEO GENERATION WITH SAFE ALIGNMENT")

    const data: VideoRequest = await request.json()

    // Validation
    if (!data.address || !data.price || !data.script || !data.imageUrls || data.imageUrls.length === 0) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 })
    }

    console.log(`📍 Property: ${data.address}`)
    console.log(`🖼️ Images: ${data.imageUrls.length}`)
    console.log(`📝 Script: ${data.script.length} chars`)

    // Step 1: Generate Rachel voice with safe alignment handling
    const audioResult = await generateRachelVoiceWithTiming(data.script)
    if (!audioResult.success) {
      return NextResponse.json({ error: `Voice generation failed: ${audioResult.error}` }, { status: 500 })
    }

    // Step 2: Calculate video timing
    const totalDuration = audioResult.duration || estimateDuration(data.script)
    const timePerImage = Math.max(3, Math.floor(totalDuration / data.imageUrls.length))

    // Step 3: Generate captions with fallback handling (use original script for captions)
    let captions: Array<{ text: string; words: WordTiming[]; startTime: number; endTime: number }>

    if (audioResult.wordTimings && audioResult.wordTimings.length > 0) {
      console.log("✅ Using word-based captions from original script")
      captions = generateWordBasedCaptions(audioResult.wordTimings, totalDuration)
    } else {
      console.log("⚠️ Falling back to sentence-level captions from original script")
      captions = generateSentenceCaptions(data.script, totalDuration) // Use original script
    }

    console.log(`📊 Video: ${totalDuration.toFixed(1)}s duration, ${timePerImage}s per image`)
    console.log(
      `🎤 Rachel voice: 0.85x speed, voice-optimized text, alignment: ${audioResult.alignmentUsed ? "Yes" : "No"}`,
    )
    console.log(`📝 Captions: ${captions.length} chunks with 500ms delay from original script`)

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
        description: `Rachel voice at 0.85x speed${audioResult.alignmentUsed ? " with word alignment" : " with estimated timing"}`,
      },
      metadata: {
        alignmentUsed: audioResult.alignmentUsed || false,
        captionDelay: 500, // ms
        captionType: audioResult.wordTimings ? "word-based" : "sentence-based",
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
