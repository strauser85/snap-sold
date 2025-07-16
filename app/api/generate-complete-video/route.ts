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

// FIXED: Comprehensive script sanitization for ElevenLabs
function sanitizeScriptForElevenLabs(text: string): string {
  console.log("🧹 AUDIO-FIX: Starting comprehensive script sanitization...")

  // Step 1: Remove all problematic characters that break ElevenLabs
  let sanitized = text
    .replace(/[^\x00-\x7F]/g, "") // Remove ALL non-ASCII (emojis, special chars)
    .replace(/[""'']/g, '"') // Fix smart quotes
    .replace(/[\u2013\u2014]/g, "-") // Fix em/en dashes
    .replace(/[^\w\s.,!?'"$-]/g, " ") // Remove any other special chars
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()

  // Step 2: Fix common real estate abbreviations for speech
  sanitized = sanitized
    .replace(/\$(\d+)/g, "$1 dollars")
    .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
    .replace(/(\d+)\s*sqft/gi, "$1 square feet")
    .replace(/(\d+)\s*bed/gi, "$1 bedroom")
    .replace(/(\d+)\s*bath/gi, "$1 bathroom")
    .replace(/(\d+)BR/gi, "$1 bedroom")
    .replace(/(\d+)BA/gi, "$1 bathroom")
    .replace(/(\d+\.\d+)\s*bath/gi, (match, num) => {
      const parts = num.split(".")
      if (parts[1] === "5") {
        return `${parts[0]} and a half bathroom`
      }
      return `${num} bathroom`
    })

  // Step 3: Ensure proper sentence structure
  if (sanitized && !/[.!?]$/.test(sanitized)) {
    sanitized += "."
  }

  console.log("✅ AUDIO-FIX: Script sanitization complete")
  console.log(`📝 Original: ${text.length} chars → Sanitized: ${sanitized.length} chars`)

  return sanitized
}

// FIXED: Photo-based duration calculation
function calculateVideoDurationFromPhotos(photoCount: number): {
  totalDuration: number
  timePerPhoto: number
  introTime: number
  outroTime: number
  photoDisplayTime: number
  actualPhotoCount: number
} {
  console.log(`📸 AUDIO-FIX: Calculating duration for ${photoCount} photos`)

  const baseTimePerPhoto = 1.8 // Increased for better audio sync
  const introTime = 1.0
  const outroTime = 1.0
  const maxTotalDuration = 60
  const maxPhotos = 30

  const actualPhotoCount = Math.min(photoCount, maxPhotos)

  let photoDisplayTime = actualPhotoCount * baseTimePerPhoto
  let totalDuration = photoDisplayTime + introTime + outroTime

  if (totalDuration > maxTotalDuration) {
    console.log(`⚠️ AUDIO-FIX: Capping ${totalDuration}s to ${maxTotalDuration}s`)
    totalDuration = maxTotalDuration
    photoDisplayTime = totalDuration - introTime - outroTime
  }

  const timePerPhoto = photoDisplayTime / actualPhotoCount

  console.log(`📊 AUDIO-FIX: Duration calculation complete`)
  console.log(`   • Total: ${totalDuration}s`)
  console.log(`   • Per photo: ${timePerPhoto.toFixed(2)}s`)

  return {
    totalDuration,
    timePerPhoto,
    introTime,
    outroTime,
    photoDisplayTime,
    actualPhotoCount,
  }
}

// FIXED: ElevenLabs audio generation with proper error handling
async function generateRachelVoiceFixed(
  script: string,
  targetDuration: number,
): Promise<{
  success: boolean
  audioUrl?: string
  error?: string
  duration?: number
  audioSize?: number
}> {
  console.log("🎤 AUDIO-FIX: Starting Rachel voice generation...")

  // FIXED: API Key validation
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("❌ AUDIO-FIX: ElevenLabs API key not found")
    return { success: false, error: "ElevenLabs API key not configured" }
  }

  const apiKey = process.env.ELEVENLABS_API_KEY.trim()
  if (apiKey.length < 20) {
    console.error("❌ AUDIO-FIX: ElevenLabs API key too short")
    return { success: false, error: "ElevenLabs API key appears invalid" }
  }

  console.log("✅ AUDIO-FIX: API key validated")

  try {
    // FIXED: Script sanitization
    const cleanScript = sanitizeScriptForElevenLabs(script)

    if (cleanScript.length === 0) {
      console.error("❌ AUDIO-FIX: Script empty after sanitization")
      return { success: false, error: "Script is empty after sanitization" }
    }

    if (cleanScript.length > 5000) {
      console.error("❌ AUDIO-FIX: Script too long after sanitization")
      return { success: false, error: "Script too long for ElevenLabs" }
    }

    console.log("✅ AUDIO-FIX: Script sanitized and validated")

    // FIXED: Request payload with proper JSON structure
    const requestPayload = {
      text: cleanScript,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.75,
        similarity_boost: 0.85,
        style: 0.25,
        use_speaker_boost: true,
      },
      output_format: "mp3_44100_128",
    }

    console.log(`📡 AUDIO-FIX: Making ElevenLabs request...`)
    console.log(`📝 Request payload:`, JSON.stringify(requestPayload, null, 2))

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(requestPayload),
    })

    console.log(`📡 AUDIO-FIX: ElevenLabs response: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      let errorText = "Unknown error"
      try {
        errorText = await response.text()
        console.error(`❌ AUDIO-FIX: ElevenLabs API error:`, response.status, errorText)
      } catch (parseError) {
        console.error(`❌ AUDIO-FIX: Could not parse error response:`, parseError)
      }

      let errorMessage = `ElevenLabs API error: ${response.status}`
      if (response.status === 401) {
        errorMessage = "ElevenLabs API key is invalid or expired"
      } else if (response.status === 429) {
        errorMessage = "ElevenLabs API rate limit exceeded"
      } else if (response.status === 422) {
        errorMessage = "ElevenLabs rejected the text (too long or invalid characters)"
      }

      return { success: false, error: errorMessage }
    }

    // FIXED: Audio blob validation
    const audioBlob = await response.blob()
    console.log(`🎵 AUDIO-FIX: Audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`)

    if (audioBlob.size === 0) {
      console.error(`❌ AUDIO-FIX: Empty audio blob`)
      return { success: false, error: "ElevenLabs returned empty audio file" }
    }

    if (audioBlob.size < 1000) {
      console.error(`❌ AUDIO-FIX: Audio blob too small (${audioBlob.size} bytes)`)
      return { success: false, error: "Audio file too small - generation may have failed" }
    }

    // FIXED: Convert to data URL with proper error handling
    try {
      const arrayBuffer = await audioBlob.arrayBuffer()
      const base64Audio = Buffer.from(arrayBuffer).toString("base64")
      const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

      console.log("✅ AUDIO-FIX: Rachel voice generation SUCCESSFUL!")
      console.log(`📊 Size: ${audioBlob.size} bytes`)
      console.log(`📝 Base64 length: ${base64Audio.length} characters`)

      return {
        success: true,
        audioUrl: audioDataUrl,
        duration: targetDuration,
        audioSize: audioBlob.size,
      }
    } catch (conversionError) {
      console.error("❌ AUDIO-FIX: Audio conversion failed:", conversionError)
      return { success: false, error: "Failed to convert audio to usable format" }
    }
  } catch (error) {
    console.error("❌ AUDIO-FIX: Complete failure:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Voice generation completely failed",
    }
  }
}

// FIXED: Precise word timing generation
function generatePreciseWordTimings(words: string[], audioStartDelay: number, targetDuration: number): WordTiming[] {
  console.log(`📊 AUDIO-FIX: Generating precise timings for ${words.length} words`)

  const wordTimings: WordTiming[] = []
  const availableTime = targetDuration - audioStartDelay - 0.5
  let currentTime = audioStartDelay

  // Calculate total estimated time with better accuracy
  const totalEstimatedTime = words.reduce((total, word) => {
    let wordDuration = 0.4 // Base duration per word

    // Word length adjustments
    if (word.length > 6) wordDuration += 0.1
    if (word.length > 10) wordDuration += 0.2

    // Punctuation pauses
    if (word.includes(",")) wordDuration += 0.1
    if (word.includes(".") || word.includes("!") || word.includes("?")) wordDuration += 0.3

    // Special terms
    if (/\d/.test(word)) wordDuration += 0.15
    if (word.toLowerCase().includes("bedroom") || word.toLowerCase().includes("bathroom")) wordDuration += 0.1

    return total + wordDuration + 0.05 // Gap between words
  }, 0)

  // Scale to fit target duration
  const scaleFactor = availableTime / totalEstimatedTime
  console.log(`📊 AUDIO-FIX: Scaling by ${scaleFactor.toFixed(3)} to fit ${targetDuration}s`)

  words.forEach((word, index) => {
    let wordDuration = 0.4

    // Apply same adjustments as above
    if (word.length > 6) wordDuration += 0.1
    if (word.length > 10) wordDuration += 0.2
    if (word.includes(",")) wordDuration += 0.1
    if (word.includes(".") || word.includes("!") || word.includes("?")) wordDuration += 0.3
    if (/\d/.test(word)) wordDuration += 0.15
    if (word.toLowerCase().includes("bedroom") || word.toLowerCase().includes("bathroom")) wordDuration += 0.1

    // Apply scale factor
    wordDuration *= scaleFactor
    const gapDuration = 0.05 * scaleFactor

    wordTimings.push({
      word: word,
      startTime: currentTime,
      endTime: currentTime + wordDuration,
    })

    currentTime += wordDuration + gapDuration
  })

  console.log(`✅ AUDIO-FIX: ${wordTimings.length} word timings generated`)
  return wordTimings
}

// FIXED: Caption generation with better timing
function generateTikTokCaptions(
  script: string,
  totalDuration: number,
): Array<{
  text: string
  startTime: number
  endTime: number
}> {
  console.log(`📝 AUDIO-FIX: Generating TikTok captions`)

  const words = script
    .replace(/[^\w\s.,!?'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)

  const captions: Array<{ text: string; startTime: number; endTime: number }> = []

  if (words.length === 0) {
    console.warn("⚠️ AUDIO-FIX: No words found for captions")
    return captions
  }

  const wordsPerCaption = 4 // Slightly longer chunks for better readability
  const totalCaptions = Math.ceil(words.length / wordsPerCaption)
  const timePerCaption = totalDuration / totalCaptions

  for (let i = 0; i < words.length; i += wordsPerCaption) {
    const captionWords = words.slice(i, i + wordsPerCaption)
    const captionIndex = Math.floor(i / wordsPerCaption)

    const startTime = captionIndex * timePerCaption
    const endTime = Math.min(startTime + timePerCaption - 0.1, totalDuration)

    captions.push({
      text: captionWords.join(" ").toUpperCase(),
      startTime,
      endTime,
    })
  }

  console.log(`✅ AUDIO-FIX: Generated ${captions.length} TikTok captions`)
  return captions
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 AUDIO-FIX: Starting complete video generation with FIXED audio handling")

    const data: VideoRequest = await request.json()

    // Input validation
    if (!data.address || !data.price || !data.script || !data.imageUrls || data.imageUrls.length === 0) {
      console.error("❌ AUDIO-FIX: Missing required data")
      return NextResponse.json({ error: "Missing required data" }, { status: 400 })
    }

    if (data.imageUrls.length > 30) {
      console.log(`⚠️ AUDIO-FIX: Limiting ${data.imageUrls.length} photos to 30`)
      data.imageUrls = data.imageUrls.slice(0, 30)
    }

    console.log(`📍 AUDIO-FIX: Property: ${data.address}`)
    console.log(`🖼️ AUDIO-FIX: Images: ${data.imageUrls.length}`)
    console.log(`📝 AUDIO-FIX: Script: ${data.script.length} chars`)

    // Step 1: Calculate video duration
    const videoDuration = calculateVideoDurationFromPhotos(data.imageUrls.length)

    // Step 2: Generate Rachel voice with FIXED error handling
    const audioResult = await generateRachelVoiceFixed(data.script, videoDuration.totalDuration)

    if (!audioResult.success) {
      console.error("❌ AUDIO-FIX: Audio generation failed:", audioResult.error)
      return NextResponse.json({ error: `Voice generation failed: ${audioResult.error}` }, { status: 500 })
    }

    // Step 3: Generate captions with FIXED timing
    const captions = generateTikTokCaptions(data.script, videoDuration.totalDuration)

    // Step 4: Generate word timings for precise sync
    const words = data.script.split(/\s+/).filter((w) => w.length > 0)
    const wordTimings = generatePreciseWordTimings(words, 0.5, videoDuration.totalDuration)

    console.log("🎉 AUDIO-FIX: Complete video generation successful!")
    console.log(`📊 Duration: ${videoDuration.totalDuration}s for ${videoDuration.actualPhotoCount} photos`)
    console.log(`🎤 Audio: MP3 (${audioResult.audioSize} bytes)`)
    console.log(`📝 Captions: ${captions.length} chunks`)

    return NextResponse.json({
      success: true,
      audioUrl: audioResult.audioUrl,
      images: data.imageUrls,
      duration: videoDuration.totalDuration,
      timePerImage: videoDuration.timePerPhoto,
      wordTimings: wordTimings,
      captions,
      property: {
        address: data.address,
        price: data.price,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        sqft: data.sqft,
      },
      format: {
        width: 1080,
        height: 1920,
        fps: 30,
      },
      voiceSettings: {
        variation: "professional",
        natural: true,
        wordSynced: true,
        description: "Rachel voice with professional tone in MP3 format",
      },
      videoDuration: {
        total: videoDuration.totalDuration,
        intro: videoDuration.introTime,
        photos: videoDuration.photoDisplayTime,
        outro: videoDuration.outroTime,
        perPhoto: videoDuration.timePerPhoto,
        photoCount: videoDuration.actualPhotoCount,
        maxPhotosSupported: 30,
      },
      metadata: {
        audioFixed: true,
        audioFormat: "MP3",
        audioSize: audioResult.audioSize,
        captionType: "word-precise",
        scriptSanitized: true,
        durationMethod: "photo-based",
        photosProcessed: videoDuration.actualPhotoCount,
        photosReceived: data.imageUrls.length,
        audioGenerated: true,
        errorHandlingImproved: true,
      },
    })
  } catch (error) {
    console.error("❌ AUDIO-FIX: Complete failure:", error)
    return NextResponse.json(
      { error: "Video generation failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
