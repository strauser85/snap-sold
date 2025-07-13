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

// Generate ElevenLabs Rachel voiceover with alignment data
async function generateRachelVoiceWithTiming(script: string): Promise<{
  success: boolean
  audioUrl?: string
  error?: string
  wordTimings?: WordTiming[]
  duration?: number
}> {
  try {
    console.log("🎤 Generating Rachel voiceover with word timing...")

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

    // Try to get alignment data first (if available)
    let alignmentData: any = null
    try {
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
              speaking_rate: 0.85, // 85% speed
            },
            output_format: "mp3_44100_128",
            apply_text_normalization: "auto",
          }),
        },
      )

      if (alignmentResponse.ok) {
        alignmentData = await alignmentResponse.json()
        console.log("✅ Got alignment data from ElevenLabs")
      }
    } catch (alignmentError) {
      console.log("⚠️ Alignment API not available, using fallback timing")
    }

    // Generate the actual audio
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
          speaking_rate: 0.85, // 85% speed
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

    // Generate word timings (either from alignment data or estimated)
    const wordTimings = generateWordTimings(cleanScript, alignmentData)
    const totalDuration =
      wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].endTime : estimateDuration(cleanScript)

    console.log("✅ Rachel voice generated with word timing")
    console.log(`📊 ${wordTimings.length} words timed over ${totalDuration.toFixed(1)}s`)

    return {
      success: true,
      audioUrl: audioDataUrl,
      wordTimings,
      duration: totalDuration,
    }
  } catch (error) {
    console.error("❌ Rachel voice failed:", error)
    return { success: false, error: error instanceof Error ? error.message : "Voice generation failed" }
  }
}

// Generate word-level timing data
function generateWordTimings(script: string, alignmentData?: any): WordTiming[] {
  const words = script.split(/\s+/).filter((word) => word.length > 0)
  const wordTimings: WordTiming[] = []

  if (alignmentData && alignmentData.alignment) {
    // Use ElevenLabs alignment data if available
    alignmentData.alignment.forEach((item: any, index: number) => {
      if (item.character && item.character.trim()) {
        wordTimings.push({
          word: item.character,
          startTime: item.start_time_seconds,
          endTime: item.end_time_seconds,
        })
      }
    })
  } else {
    // Fallback: Estimate word timing based on speech patterns
    let currentTime = 0.3 // Start with small delay
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

      wordTimings.push({
        word: word,
        startTime: currentTime,
        endTime: currentTime + wordDuration,
      })

      currentTime += wordDuration + 0.05 // Small gap between words
    })
  }

  return wordTimings
}

// Estimate total duration
function estimateDuration(script: string): number {
  const wordCount = script.split(/\s+/).length
  return Math.max(30, (wordCount / (150 * 0.85)) * 60) // 85% speed adjustment
}

// Generate TikTok captions with word-level timing
function generateWordBasedCaptions(wordTimings: WordTiming[]): Array<{
  text: string
  words: WordTiming[]
  startTime: number
  endTime: number
}> {
  const captions: Array<{ text: string; words: WordTiming[]; startTime: number; endTime: number }> = []

  // Group words into caption chunks (4-6 words per caption for readability)
  const wordsPerCaption = 5

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

  return captions
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 COMPLETE VIDEO GENERATION WITH WORD SYNC")

    const data: VideoRequest = await request.json()

    // Validation
    if (!data.address || !data.price || !data.script || !data.imageUrls || data.imageUrls.length === 0) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 })
    }

    console.log(`📍 Property: ${data.address}`)
    console.log(`🖼️ Images: ${data.imageUrls.length}`)
    console.log(`📝 Script: ${data.script.length} chars`)

    // Step 1: Generate Rachel voice with word timing
    const audioResult = await generateRachelVoiceWithTiming(data.script)
    if (!audioResult.success) {
      return NextResponse.json({ error: `Voice generation failed: ${audioResult.error}` }, { status: 500 })
    }

    // Step 2: Calculate video timing
    const totalDuration = audioResult.duration || estimateDuration(data.script)
    const timePerImage = Math.max(3, Math.floor(totalDuration / data.imageUrls.length))

    // Step 3: Generate word-based captions
    const wordBasedCaptions = generateWordBasedCaptions(audioResult.wordTimings || [])

    console.log(`📊 Video: ${totalDuration.toFixed(1)}s duration, ${timePerImage}s per image`)
    console.log(`🎤 Rachel voice: ${audioResult.wordTimings?.length || 0} words timed`)
    console.log(`📝 Captions: ${wordBasedCaptions.length} caption chunks`)

    // Return everything needed for client-side video generation
    return NextResponse.json({
      success: true,
      audioUrl: audioResult.audioUrl,
      images: data.imageUrls,
      duration: totalDuration,
      timePerImage,
      wordTimings: audioResult.wordTimings,
      captions: wordBasedCaptions,
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
        wordSynced: true,
        description: "Rachel voice with word-level timing synchronization",
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
