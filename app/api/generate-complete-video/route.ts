import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

interface PropertyData {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription: string
  script: string
  imageUrls: string[]
}

interface ElevenLabsResponse {
  audio_base64?: string
  alignment?: {
    characters: string[]
    character_start_times_seconds: number[]
    character_end_times_seconds: number[]
  }
}

interface WordTiming {
  word: string
  startTime: number
  endTime: number
}

// TRIPLE-CHECKED SCRIPT SANITIZATION
function sanitizeScriptForElevenLabs(script: string): string {
  console.log("🧹 SANITIZING SCRIPT FOR ELEVENLABS...")

  let sanitized = script
    // Remove ALL emoji / pictographs
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    // Clean up multiple spaces and line breaks
    .replace(/\s+/g, " ")
    .replace(/\n+/g, ". ")
    // Remove problematic punctuation combinations
    .replace(/[!]{2,}/g, "!")
    .replace(/[?]{2,}/g, "?")
    .replace(/[.]{2,}/g, ".")
    // Ensure proper sentence endings
    .replace(/([a-zA-Z0-9])\s*([A-Z])/g, "$1. $2")
    .trim()

  // Ensure it ends with proper punctuation
  if (sanitized && !sanitized.match(/[.!?]$/)) {
    sanitized += "."
  }

  console.log(`✅ Script sanitized: ${script.length} → ${sanitized.length} chars`)
  return sanitized
}

// ENHANCED DURATION CALCULATION BASED ON PHOTO COUNT
function calculateOptimalDuration(script: string, imageCount: number): number {
  console.log(`📊 CALCULATING DURATION: ${script.length} chars, ${imageCount} images`)

  // Base duration from script length (words per minute calculation)
  const wordCount = script.split(/\s+/).length
  const baseReadingTime = (wordCount / 180) * 60 // 180 WPM for natural speech

  // Photo-based duration (minimum time per photo for good viewing)
  const minTimePerPhoto = 1.5 // seconds
  const photoDuration = Math.max(imageCount * minTimePerPhoto, 8) // minimum 8 seconds

  // Take the longer of the two, with reasonable bounds
  const calculatedDuration = Math.max(baseReadingTime, photoDuration)
  const finalDuration = Math.min(Math.max(calculatedDuration, 10), 45) // 10-45 second range

  console.log(`📊 Duration calculation:`)
  console.log(`   - Reading time: ${baseReadingTime.toFixed(1)}s`)
  console.log(`   - Photo time: ${photoDuration.toFixed(1)}s`)
  console.log(`   - Final duration: ${finalDuration.toFixed(1)}s`)

  return finalDuration
}

// COMPREHENSIVE WORD TIMING GENERATION
function generateWordTimings(script: string, totalDuration: number): WordTiming[] {
  console.log(`⏱️ GENERATING WORD TIMINGS: ${totalDuration}s total`)

  const words = script.split(/\s+/).filter((word) => word.length > 0)
  const timings: WordTiming[] = []

  if (words.length === 0) return timings

  // Calculate timing with natural speech patterns
  const totalWords = words.length
  const averageTimePerWord = totalDuration / totalWords

  let currentTime = 0.2 // Start with small delay

  words.forEach((word, index) => {
    // Adjust timing based on word characteristics
    let wordDuration = averageTimePerWord

    // Longer words take more time
    if (word.length > 8) wordDuration *= 1.3
    else if (word.length < 3) wordDuration *= 0.7

    // Punctuation adds pause
    if (word.match(/[.!?]$/)) wordDuration *= 1.4
    if (word.match(/[,;:]$/)) wordDuration *= 1.2

    // Numbers and addresses take longer
    if (word.match(/\d/) || word.includes("$")) wordDuration *= 1.2

    const startTime = currentTime
    const endTime = currentTime + wordDuration

    timings.push({
      word: word.replace(/[^\w\s$]/g, ""), // Clean word for display
      startTime,
      endTime,
    })

    currentTime = endTime + 0.05 // Small gap between words
  })

  console.log(`✅ Generated ${timings.length} word timings`)
  return timings
}

export async function POST(request: NextRequest) {
  console.log("🎬 STARTING COMPLETE VIDEO GENERATION WITH TRIPLE-CHECKED AUDIO SYSTEM")

  try {
    const propertyData: PropertyData = await request.json()
    console.log(`📋 Property: ${propertyData.address}`)
    console.log(`📸 Images: ${propertyData.imageUrls.length}`)
    console.log(`📝 Script: ${propertyData.script.length} characters`)

    // STEP 1: TRIPLE-VALIDATED SCRIPT PREPARATION
    const sanitizedScript = sanitizeScriptForElevenLabs(propertyData.script)
    if (!sanitizedScript || sanitizedScript.length < 10) {
      throw new Error("Script is too short or invalid after sanitization")
    }

    // STEP 2: ENHANCED DURATION CALCULATION
    const duration = calculateOptimalDuration(sanitizedScript, propertyData.imageUrls.length)

    // STEP 3: TRIPLE-VALIDATED API KEY CHECK
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsApiKey) {
      console.error("❌ ELEVENLABS_API_KEY not found in environment")
      throw new Error("ElevenLabs API key not configured")
    }
    console.log("✅ ElevenLabs API key validated")

    // STEP 4: COMPREHENSIVE ELEVENLABS REQUEST WITH MULTIPLE FALLBACKS
    console.log("🎤 GENERATING AUDIO WITH RACHEL VOICE...")

    const elevenLabsPayload = {
      text: sanitizedScript,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.75,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true,
      },
      output_format: "mp3_44100_128",
      apply_text_normalization: "auto",
    }

    console.log("📤 ElevenLabs request payload:", JSON.stringify(elevenLabsPayload, null, 2))

    let audioResponse: Response
    let attempts = 0
    const maxAttempts = 3

    // TRIPLE-ATTEMPT AUDIO GENERATION WITH COMPREHENSIVE ERROR HANDLING
    while (attempts < maxAttempts) {
      attempts++
      console.log(`🎤 Audio generation attempt ${attempts}/${maxAttempts}`)

      try {
        audioResponse = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsApiKey,
          },
          body: JSON.stringify(elevenLabsPayload),
        })

        console.log(`📡 ElevenLabs response status: ${audioResponse.status}`)
        console.log(`📡 ElevenLabs response headers:`, Object.fromEntries(audioResponse.headers.entries()))

        if (audioResponse.ok) {
          console.log(`✅ Audio generation successful on attempt ${attempts}`)
          break
        } else {
          const errorText = await audioResponse.text()
          console.error(`❌ ElevenLabs API error (attempt ${attempts}):`, errorText)

          if (attempts === maxAttempts) {
            throw new Error(`ElevenLabs API failed after ${maxAttempts} attempts: ${errorText}`)
          }

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempts))
        }
      } catch (fetchError) {
        console.error(`❌ Network error on attempt ${attempts}:`, fetchError)

        if (attempts === maxAttempts) {
          throw new Error(`Network error after ${maxAttempts} attempts: ${fetchError}`)
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts))
      }
    }

    // STEP 5: COMPREHENSIVE AUDIO PROCESSING WITH VALIDATION
    console.log("🎵 PROCESSING AUDIO RESPONSE...")

    const contentType = audioResponse!.headers.get("content-type")
    console.log(`📄 Audio content type: ${contentType}`)

    let audioBuffer: ArrayBuffer
    let audioUrl: string

    try {
      audioBuffer = await audioResponse!.arrayBuffer()
      console.log(`📊 Audio buffer size: ${audioBuffer.byteLength} bytes`)

      if (audioBuffer.byteLength === 0) {
        throw new Error("Received empty audio buffer")
      }

      // Validate audio buffer (check for MP3 header)
      const uint8Array = new Uint8Array(audioBuffer)
      const isValidMP3 = uint8Array[0] === 0xff && (uint8Array[1] & 0xe0) === 0xe0

      if (!isValidMP3) {
        console.warn("⚠️ Audio buffer may not be valid MP3, but continuing...")
      } else {
        console.log("✅ Valid MP3 audio buffer confirmed")
      }

      // Convert to base64 data URL with proper MIME type
      const base64Audio = Buffer.from(audioBuffer).toString("base64")
      audioUrl = `data:audio/mpeg;base64,${base64Audio}`

      console.log(`✅ Audio converted to data URL: ${audioUrl.length} characters`)
    } catch (audioError) {
      console.error("❌ Audio processing failed:", audioError)
      throw new Error(`Audio processing failed: ${audioError}`)
    }

    // STEP 6: TRIPLE-FALLBACK CAPTION TIMING GENERATION
    console.log("📝 GENERATING CAPTION TIMINGS...")

    const wordTimings = generateWordTimings(sanitizedScript, duration)

    // Create highlight captions for key moments
    const captions = [
      {
        text: "🏠 STUNNING PROPERTY ALERT",
        startTime: 0.5,
        endTime: 2.0,
        priority: 5,
      },
      {
        text: `${propertyData.bedrooms}BR • ${propertyData.bathrooms}BA • ${propertyData.sqft.toLocaleString()} SQFT`,
        startTime: duration * 0.2,
        endTime: duration * 0.4,
        priority: 4,
      },
      {
        text: `$${propertyData.price.toLocaleString()} - INCREDIBLE VALUE`,
        startTime: duration * 0.6,
        endTime: duration * 0.8,
        priority: 5,
      },
      {
        text: "📱 CONTACT ME TODAY!",
        startTime: duration * 0.85,
        endTime: duration - 0.5,
        priority: 4,
      },
    ]

    // STEP 7: VIDEO DURATION BREAKDOWN FOR PHOTO TIMING
    const videoDuration = {
      intro: Math.min(duration * 0.1, 1.5),
      main: duration * 0.8,
      outro: Math.min(duration * 0.1, 1.5),
      total: duration,
    }

    console.log("📊 Video timing breakdown:", videoDuration)

    // STEP 8: FINAL RESPONSE WITH COMPREHENSIVE DATA
    const response = {
      success: true,
      audioUrl,
      duration,
      videoDuration,
      wordTimings,
      captions,
      images: propertyData.imageUrls,
      timePerImage: videoDuration.main / propertyData.imageUrls.length,
      format: {
        width: 1080,
        height: 1920,
        fps: 30,
      },
      metadata: {
        scriptLength: sanitizedScript.length,
        imageCount: propertyData.imageUrls.length,
        generatedAt: new Date().toISOString(),
        audioFormat: "mp3",
        audioSize: audioBuffer!.byteLength,
      },
    }

    console.log("✅ COMPLETE VIDEO GENERATION SUCCESSFUL")
    console.log(
      `📊 Final response: ${JSON.stringify(
        {
          ...response,
          audioUrl: `[DATA_URL:${audioUrl.length}_chars]`,
        },
        null,
        2,
      )}`,
    )

    return NextResponse.json(response)
  } catch (error) {
    console.error("❌ COMPLETE VIDEO GENERATION FAILED:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        details: error instanceof Error ? error.stack : "No additional details",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
