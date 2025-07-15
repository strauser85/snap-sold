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

// PHOTO-BASED VIDEO DURATION CALCULATION - SUPPORTS UP TO 30 PHOTOS
function calculateVideoDurationFromPhotos(photoCount: number): {
  totalDuration: number
  timePerPhoto: number
  introTime: number
  outroTime: number
  photoDisplayTime: number
  actualPhotoCount: number
} {
  console.log(`📸 Calculating video duration for ${photoCount} photos`)

  // Base timing rules
  const baseTimePerPhoto = 1.5 // 1.5 seconds per photo
  const introTime = 1.5 // 1.5 seconds intro
  const outroTime = 1.5 // 1.5 seconds outro
  const maxTotalDuration = 60 // Cap at 60 seconds for 30 photos
  const maxPhotos = 30 // Maximum photos supported

  // Use all photos up to the maximum
  const actualPhotoCount = Math.min(photoCount, maxPhotos)

  if (photoCount > maxPhotos) {
    console.log(`⚠️ Photo count ${photoCount} exceeds maximum ${maxPhotos}, using first ${maxPhotos} photos`)
  }

  // Calculate photo display time
  let photoDisplayTime = actualPhotoCount * baseTimePerPhoto
  let totalDuration = photoDisplayTime + introTime + outroTime

  // Apply 60-second cap for max photos
  if (totalDuration > maxTotalDuration) {
    console.log(`⚠️ Video would be ${totalDuration}s, capping at ${maxTotalDuration}s`)
    totalDuration = maxTotalDuration
    photoDisplayTime = totalDuration - introTime - outroTime
  }

  const timePerPhoto = photoDisplayTime / actualPhotoCount

  console.log(`📊 Video timing calculated for ${actualPhotoCount} photos:`)
  console.log(`   • Total duration: ${totalDuration}s`)
  console.log(`   • Intro: ${introTime}s`)
  console.log(`   • Photos: ${photoDisplayTime}s (${timePerPhoto.toFixed(2)}s each)`)
  console.log(`   • Outro: ${outroTime}s`)

  return {
    totalDuration,
    timePerPhoto,
    introTime,
    outroTime,
    photoDisplayTime,
    actualPhotoCount,
  }
}

// DYNAMIC VOICE VARIATIONS - Different settings for personality
const VOICE_VARIATIONS = {
  energetic: {
    stability: 0.65,
    similarity_boost: 0.9,
    style: 0.35,
    speaking_rate: 0.9,
    description: "energetic and enthusiastic",
  },
  professional: {
    stability: 0.85,
    similarity_boost: 0.8,
    style: 0.15,
    speaking_rate: 0.8,
    description: "professional and clear",
  },
  conversational: {
    stability: 0.75,
    similarity_boost: 0.85,
    style: 0.25,
    speaking_rate: 0.85,
    description: "conversational and friendly",
  },
  confident: {
    stability: 0.8,
    similarity_boost: 0.88,
    style: 0.3,
    speaking_rate: 0.82,
    description: "confident and persuasive",
  },
  warm: {
    stability: 0.78,
    similarity_boost: 0.83,
    style: 0.2,
    speaking_rate: 0.87,
    description: "warm and inviting",
  },
}

// ADJUST SCRIPT PACING TO MATCH VIDEO DURATION
function adjustScriptForDuration(script: string, targetDuration: number, speakingRate: number): string {
  console.log(`📝 Adjusting script pacing for ${targetDuration}s target duration`)

  const words = script.split(/\s+/)
  const estimatedCurrentDuration = (words.length / (150 * speakingRate)) * 60

  console.log(`📊 Current estimated duration: ${estimatedCurrentDuration.toFixed(1)}s`)
  console.log(`🎯 Target duration: ${targetDuration}s`)

  // If script is too long, add pauses and slower pacing cues
  if (estimatedCurrentDuration > targetDuration + 2) {
    console.log("⚠️ Script too long - adding pacing adjustments")
    return script
      .replace(/\./g, ". ") // Add extra space after periods
      .replace(/,/g, ", ") // Add extra space after commas
      .replace(/!/g, "! ") // Add extra space after exclamations
  }

  // If script is too short, add descriptive elements
  if (estimatedCurrentDuration < targetDuration - 2) {
    console.log("⚠️ Script too short - adding descriptive elements")
    // Add natural extensions without changing core message
    return script
      .replace(/bedroom/gi, "spacious bedroom")
      .replace(/bathroom/gi, "beautiful bathroom")
      .replace(/kitchen/gi, "stunning kitchen")
      .replace(/home/gi, "incredible home")
  }

  console.log("✅ Script pacing is appropriate for target duration")
  return script
}

// FIXED: Generate ElevenLabs Rachel voiceover with WAV format for better compatibility
async function generateRachelVoiceWithWordTimestamps(
  script: string,
  address: string,
  targetDuration: number,
): Promise<{
  success: boolean
  audioUrl?: string
  error?: string
  wordTimings?: WordTiming[]
  duration?: number
  alignmentUsed?: boolean
  originalScript?: string
  sanitizedScript?: string
  voiceVariation?: string
}> {
  try {
    console.log("🎤 Generating Rachel voiceover with WAV format for better codec compatibility...")

    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured")
    }

    const apiKey = process.env.ELEVENLABS_API_KEY.trim()
    if (apiKey.length < 20) {
      throw new Error("ElevenLabs API key appears invalid")
    }

    // Step 1: SELECT DYNAMIC VOICE VARIATION based on address
    const addressSeed = address.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const variationKeys = Object.keys(VOICE_VARIATIONS)
    const selectedVariationKey = variationKeys[addressSeed % variationKeys.length]
    const selectedVariation = VOICE_VARIATIONS[selectedVariationKey as keyof typeof VOICE_VARIATIONS]

    console.log(`🎭 Selected voice variation: ${selectedVariationKey} (${selectedVariation.description})`)

    // Step 2: Adjust script pacing for target duration
    const adjustedScript = adjustScriptForDuration(script, targetDuration, selectedVariation.speaking_rate)

    // Step 3: Apply the sanitization function
    const cleanScript = sanitizeScript(adjustedScript)

    console.log("🧹 SANITIZED SCRIPT FOR ELEVENLABS:")
    console.log("📝 Original length:", script.length)
    console.log("📝 Adjusted length:", adjustedScript.length)
    console.log("📝 Cleaned length:", cleanScript.length)
    console.log("🔍 Cleaned script:", cleanScript.substring(0, 200) + "...")

    // Step 4: Validate cleaned script
    if (cleanScript.length === 0) {
      throw new Error("Script is empty after sanitization")
    }

    if (cleanScript.length > 5000) {
      throw new Error("Script too long for ElevenLabs (max 5000 characters after sanitization)")
    }

    // Step 5: FIXED - Use WAV format for better browser compatibility
    const requestPayload = {
      text: cleanScript,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: selectedVariation.stability,
        similarity_boost: selectedVariation.similarity_boost,
        style: selectedVariation.style,
        use_speaker_boost: true,
        speaking_rate: selectedVariation.speaking_rate,
      },
      output_format: "pcm_44100", // WAV format for better compatibility
      enable_logging: false,
    }

    console.log(`📦 ElevenLabs payload prepared with ${selectedVariationKey} voice variation`)
    console.log("🎛️ Voice settings:", requestPayload.voice_settings)
    console.log("🎵 Audio format: WAV (PCM 44.1kHz) for better codec compatibility")

    // Step 6: Make API request for WAV audio
    console.log("📡 Making ElevenLabs API request for WAV audio generation...")

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {
      method: "POST",
      headers: {
        Accept: "audio/wav", // Request WAV audio
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(requestPayload),
    })

    console.log(`📡 ElevenLabs API response: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ ElevenLabs API error:", response.status, errorText)

      let errorMessage = `ElevenLabs API error: ${response.status}`
      if (response.status === 401) {
        errorMessage = "ElevenLabs API key is invalid or expired"
      } else if (response.status === 429) {
        errorMessage = "ElevenLabs API rate limit exceeded"
      } else if (response.status === 422) {
        errorMessage = "ElevenLabs rejected the text (too long or invalid characters)"
      }

      throw new Error(errorMessage)
    }

    // Step 7: FIXED - Handle WAV audio response properly
    const audioBlob = await response.blob()
    console.log(`🎵 WAV audio blob received: ${audioBlob.size} bytes, type: ${audioBlob.type}`)

    if (audioBlob.size === 0) {
      throw new Error("ElevenLabs returned empty audio")
    }

    // Convert WAV to data URL for immediate use
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioDataUrl = `data:audio/wav;base64,${base64Audio}`

    // Step 8: Generate fallback word timings with DURATION MATCHING
    console.log("⚠️ Using fallback word timing generation with duration matching")
    const words = adjustedScript.split(/\s+/).filter((w) => w.length > 0)
    const wordTimings = generateFallbackWordTimings(words, 0.5, selectedVariation.speaking_rate, targetDuration)

    console.log("✅ Rachel voice generated successfully with WAV format for better compatibility")
    console.log(`🎭 Voice style: ${selectedVariationKey} (${selectedVariation.description})`)
    console.log(`📊 ${wordTimings.length} words timed over ${targetDuration.toFixed(1)}s`)
    console.log(`🎵 Audio data URL length: ${audioDataUrl.length} characters`)
    console.log(`🔧 Audio format: WAV for maximum browser compatibility`)

    return {
      success: true,
      audioUrl: audioDataUrl,
      wordTimings,
      duration: targetDuration,
      alignmentUsed: false, // Using fallback timing
      originalScript: script,
      sanitizedScript: cleanScript,
      voiceVariation: `${selectedVariationKey} (${selectedVariation.description})`,
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

// Generate fallback word timings with DURATION MATCHING
function generateFallbackWordTimings(
  words: string[],
  audioStartDelay = 0.5,
  speakingRate = 0.85,
  targetDuration: number,
): WordTiming[] {
  const wordTimings: WordTiming[] = []
  const availableTime = targetDuration - audioStartDelay - 0.5 // Leave 0.5s at end
  let currentTime = audioStartDelay

  // Calculate time per word to fit target duration
  const totalWordTime = words.reduce((total, word) => {
    let wordDuration = 0.45 / speakingRate // Base duration

    // Adjust for word characteristics
    if (word.length > 6) wordDuration += 0.15 / speakingRate
    if (word.length > 10) wordDuration += 0.25 / speakingRate

    // Punctuation adds natural pauses
    if (word.includes(",")) wordDuration += 0.15 / speakingRate
    if (word.includes(".") || word.includes("!") || word.includes("?")) wordDuration += 0.4 / speakingRate

    // Numbers and property terms need more time
    if (/\d/.test(word)) wordDuration += 0.2 / speakingRate
    if (word.toLowerCase().includes("bedroom") || word.toLowerCase().includes("bathroom"))
      wordDuration += 0.15 / speakingRate

    return total + wordDuration + 0.08 / speakingRate // Include gap
  }, 0)

  // Scale timing to fit target duration
  const scaleFactor = availableTime / totalWordTime
  console.log(`📊 Scaling word timing by ${scaleFactor.toFixed(2)} to fit ${targetDuration}s`)

  words.forEach((word, index) => {
    let wordDuration = 0.45 / speakingRate

    // Adjust for word characteristics
    if (word.length > 6) wordDuration += 0.15 / speakingRate
    if (word.length > 10) wordDuration += 0.25 / speakingRate

    // Punctuation adds natural pauses
    if (word.includes(",")) wordDuration += 0.15 / speakingRate
    if (word.includes(".") || word.includes("!") || word.includes("?")) wordDuration += 0.4 / speakingRate

    // Numbers and property terms need more time
    if (/\d/.test(word)) wordDuration += 0.2 / speakingRate
    if (word.toLowerCase().includes("bedroom") || word.toLowerCase().includes("bathroom"))
      wordDuration += 0.15 / speakingRate

    // Apply scale factor
    wordDuration *= scaleFactor
    const gapDuration = (0.08 / speakingRate) * scaleFactor

    wordTimings.push({
      word: word,
      startTime: currentTime,
      endTime: currentTime + wordDuration,
    })

    currentTime += wordDuration + gapDuration
  })

  return wordTimings
}

// Generate captions that sync with actual audio timing
function generatePreciseWordCaptions(
  wordTimings: WordTiming[],
  totalDuration: number,
  audioStartDelay = 0.5,
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
        startTime: captionWords[0].startTime,
        endTime: captionWords[captionWords.length - 1].endTime,
      })
    }
  }

  console.log(`✅ Generated ${captions.length} audio-synced captions`)
  console.log(`🎵 First caption starts at: ${captions[0]?.startTime.toFixed(2)}s (after audio delay)`)
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
    console.log("🎬 COMPLETE VIDEO GENERATION WITH WAV AUDIO FOR BETTER CODEC COMPATIBILITY")

    const data: VideoRequest = await request.json()

    // Validation - ENSURE WE SUPPORT UP TO 30 PHOTOS
    if (!data.address || !data.price || !data.script || !data.imageUrls || data.imageUrls.length === 0) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 })
    }

    if (data.imageUrls.length > 30) {
      console.log(`⚠️ Received ${data.imageUrls.length} photos, limiting to 30 for performance`)
      data.imageUrls = data.imageUrls.slice(0, 30)
    }

    console.log(`📍 Property: ${data.address}`)
    console.log(`🖼️ Images: ${data.imageUrls.length} (processing ALL images up to 30 max)`)
    console.log(`📝 Script: ${data.script.length} chars`)

    // Step 1: Calculate video duration based on photo count (supports up to 30 photos)
    const videoDuration = calculateVideoDurationFromPhotos(data.imageUrls.length)

    // Step 2: Generate Rachel voice with WAV format for better compatibility
    const audioResult = await generateRachelVoiceWithWordTimestamps(
      data.script,
      data.address,
      videoDuration.totalDuration,
    )

    if (!audioResult.success) {
      console.error("❌ Audio generation failed:", audioResult.error)
      return NextResponse.json({ error: `Voice generation failed: ${audioResult.error}` }, { status: 500 })
    }

    // Step 3: Generate captions with precise timing
    let captions: Array<{ text: string; words: WordTiming[]; startTime: number; endTime: number }>

    if (audioResult.wordTimings && audioResult.wordTimings.length > 0 && audioResult.alignmentUsed) {
      console.log("✅ Using precise word-based captions from ElevenLabs timestamps")
      captions = generatePreciseWordCaptions(audioResult.wordTimings, videoDuration.totalDuration, 0.5)
    } else {
      console.log("⚠️ Falling back to sentence-level captions with estimated timing")
      captions = generateSentenceCaptions(data.script, videoDuration.totalDuration)
    }

    console.log(
      `📊 Video: ${videoDuration.totalDuration.toFixed(1)}s duration based on ${videoDuration.actualPhotoCount} photos`,
    )
    console.log(`📸 Photo timing: ${videoDuration.timePerPhoto.toFixed(2)}s per photo`)
    console.log(`🎤 Rachel voice: ${audioResult.voiceVariation || "standard variation"}, WAV format for compatibility`)
    console.log(`📝 Captions: ${captions.length} chunks with precise timing`)

    // Return everything needed for client-side video generation
    return NextResponse.json({
      success: true,
      audioUrl: audioResult.audioUrl,
      images: data.imageUrls, // Return ALL processed images
      duration: videoDuration.totalDuration,
      timePerImage: videoDuration.timePerPhoto,
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
        width: 1080,
        height: 1920,
        fps: 30,
      },
      voiceSettings: {
        variation: audioResult.voiceVariation || "standard",
        natural: true,
        wordSynced: audioResult.alignmentUsed || false,
        alignmentUsed: audioResult.alignmentUsed || false,
        description: `Rachel voice with ${audioResult.voiceVariation || "standard variation"} in WAV format for better compatibility`,
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
        alignmentUsed: audioResult.alignmentUsed || false,
        captionDelay: 0,
        captionType: audioResult.alignmentUsed ? "word-precise" : "sentence-estimated",
        scriptSanitized: true,
        originalScriptLength: data.script.length,
        sanitizedScriptLength: audioResult.sanitizedScript?.length || 0,
        voiceVariation: audioResult.voiceVariation || "standard",
        durationMethod: "photo-based",
        photosProcessed: videoDuration.actualPhotoCount,
        photosReceived: data.imageUrls.length,
        audioGenerated: audioResult.success,
        audioError: audioResult.error || null,
        audioFormat: "WAV (PCM 44.1kHz) for maximum browser compatibility",
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
