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

// Generate ElevenLabs Rachel voiceover with safe alignment handling
async function generateRachelVoiceWithTiming(script: string): Promise<{
  success: boolean
  audioUrl?: string
  error?: string
  wordTimings?: WordTiming[]
  duration?: number
  alignmentUsed?: boolean
}> {
  try {
    console.log("🎤 Generating Rachel voiceover at 0.85x speed with alignment...")

    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured")
    }

    const apiKey = process.env.ELEVENLABS_API_KEY.trim()
    if (apiKey.length < 20) {
      throw new Error("ElevenLabs API key appears invalid")
    }

    // Clean script for TTS
    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\$(\d+)/g, "$1 dollars")
      .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
      .replace(/(\d+)\s*bed/gi, "$1 bedroom")
      .replace(/(\d+)\s*bath/gi, "$1 bathroom")
      .trim()

    // Try to get alignment data with safe error handling
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
              speaking_rate: 0.85, // 85% speed for better readability
            },
            output_format: "mp3_44100_128",
            apply_text_normalization: "auto",
          }),
        },
      )

      if (alignmentResponse.ok) {
        const alignmentResult = await alignmentResponse.json()

        // Safe check for alignment data structure
        if (
          alignmentResult &&
          alignmentResult.alignment &&
          Array.isArray(alignmentResult.alignment) &&
          alignmentResult.alignment.length > 0
        ) {
          alignmentData = alignmentResult
          alignmentUsed = true
          console.log("✅ Got valid alignment data from ElevenLabs")
          console.log(`📊 Alignment contains ${alignmentResult.alignment.length} timing points`)
        } else {
          console.warn("⚠️ No alignment data returned from ElevenLabs - response structure invalid")
          console.log("Response structure:", JSON.stringify(alignmentResult, null, 2))
        }
      } else {
        console.warn(`⚠️ ElevenLabs alignment API returned ${alignmentResponse.status}`)
      }
    } catch (alignmentError) {
      console.warn("⚠️ ElevenLabs alignment API failed:", alignmentError)
      console.log("Continuing with fallback timing estimation...")
    }

    // Generate the actual audio with 0.85x speed
    console.log("🎵 Generating Rachel audio at 0.85x speed...")

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
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

    // Generate word timings with safe alignment handling
    const wordTimings = generateWordTimings(cleanScript, alignmentData, alignmentUsed)
    const totalDuration =
      wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].endTime + 1 : estimateDuration(cleanScript)

    console.log("✅ Rachel voice generated successfully")
    console.log(`📊 ${wordTimings.length} words timed over ${totalDuration.toFixed(1)}s`)
    console.log(`🎯 Alignment used: ${alignmentUsed ? "Yes" : "No (fallback timing)"}`)

    return {
      success: true,
      audioUrl: audioDataUrl,
      wordTimings,
      duration: totalDuration,
      alignmentUsed,
    }
  } catch (error) {
    console.error("❌ Rachel voice generation failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Voice generation failed",
      alignmentUsed: false,
    }
  }
}

// Generate word-level timing data with safe alignment handling
function generateWordTimings(script: string, alignmentData?: any, alignmentUsed?: boolean): WordTiming[] {
  const words = script.split(/\s+/).filter((word) => word.length > 0)
  const wordTimings: WordTiming[] = []

  if (alignmentUsed && alignmentData && alignmentData.alignment && Array.isArray(alignmentData.alignment)) {
    try {
      console.log("🎯 Using ElevenLabs alignment data for precise timing")

      // Process alignment data safely
      let wordIndex = 0
      let currentWord = ""

      alignmentData.alignment.forEach((item: any, index: number) => {
        if (
          item &&
          typeof item === "object" &&
          "character" in item &&
          "start_time_seconds" in item &&
          "end_time_seconds" in item
        ) {
          const char = item.character
          const startTime = typeof item.start_time_seconds === "number" ? item.start_time_seconds : 0
          const endTime = typeof item.end_time_seconds === "number" ? item.end_time_seconds : startTime + 0.1

          if (char && char.trim()) {
            currentWord += char

            // Check if we've completed a word (space or end of alignment)
            if (char === " " || index === alignmentData.alignment.length - 1) {
              if (currentWord.trim() && wordIndex < words.length) {
                wordTimings.push({
                  word: currentWord.trim(),
                  startTime: Math.max(0, startTime),
                  endTime: Math.max(startTime + 0.1, endTime),
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
      console.log("Falling back to estimated timing...")
      return generateFallbackWordTimings(words, 0)
    }
  } else {
    console.log("🔄 Using fallback word timing estimation")
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

// Generate sentence-level captions as fallback with 500ms delay
function generateSentenceCaptions(
  script: string,
  totalDuration: number,
): Array<{
  text: string
  words: WordTiming[]
  startTime: number
  endTime: number
}> {
  console.log("📝 Generating sentence-level captions with 500ms delay")

  // Split into sentences
  const sentences = script
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

  console.log(`✅ Generated ${captions.length} sentence-level captions`)
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

    // Step 3: Generate captions with fallback handling
    let captions: Array<{ text: string; words: WordTiming[]; startTime: number; endTime: number }>

    if (audioResult.wordTimings && audioResult.wordTimings.length > 0) {
      console.log("✅ Using word-based captions")
      captions = generateWordBasedCaptions(audioResult.wordTimings, totalDuration)
    } else {
      console.log("⚠️ Falling back to sentence-level captions")
      captions = generateSentenceCaptions(data.script, totalDuration)
    }

    console.log(`📊 Video: ${totalDuration.toFixed(1)}s duration, ${timePerImage}s per image`)
    console.log(`🎤 Rachel voice: 0.85x speed, alignment: ${audioResult.alignmentUsed ? "Yes" : "No"}`)
    console.log(`📝 Captions: ${captions.length} chunks with 500ms delay`)

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
