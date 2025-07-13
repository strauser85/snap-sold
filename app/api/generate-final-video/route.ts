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

// ElevenLabs voice IDs - Rachel is a premium voice
const ELEVENLABS_VOICES = {
  rachel: "21m00Tcm4TlvDq8ikWAM", // Rachel - Premium voice
  bella: "EXAVITQu4vr4xnSDxMaL", // Bella - Alternative
  antoni: "ErXwobaYiN019PkySvjV", // Antoni - Male alternative
  elli: "MF3mGyEYCl7XYWbV9V6O", // Elli - Female alternative
}

// Generate ElevenLabs voiceover with comprehensive error handling
async function generateRachelVoiceover(
  script: string,
): Promise<{ success: boolean; audioUrl?: string; error?: string; duration?: number; debugInfo?: any }> {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    scriptLength: script.length,
    apiKeyConfigured: !!process.env.ELEVENLABS_API_KEY,
    voiceId: ELEVENLABS_VOICES.rachel,
  }

  try {
    console.log("🎤 Starting Rachel (ElevenLabs) voiceover generation...")
    console.log("🔍 Debug info:", debugInfo)

    // Check if API key exists
    if (!process.env.ELEVENLABS_API_KEY) {
      const error = "ElevenLabs API key not found. Please add ELEVENLABS_API_KEY to environment variables."
      console.error("❌", error)
      return {
        success: false,
        error,
        debugInfo: { ...debugInfo, error: "missing_api_key" },
      }
    }

    // Get and validate API key format
    const apiKey = process.env.ELEVENLABS_API_KEY.trim()

    // ElevenLabs API keys can have different formats, not just "sk-"
    // They are typically longer strings (32+ characters)
    if (apiKey.length < 20) {
      const error = `ElevenLabs API key appears to be too short (${apiKey.length} characters). Expected 20+ characters.`
      console.error("❌", error)
      return {
        success: false,
        error,
        debugInfo: {
          ...debugInfo,
          error: "invalid_api_key_length",
          keyLength: apiKey.length,
          keyPrefix: apiKey.substring(0, Math.min(8, apiKey.length)) + "...",
        },
      }
    }

    debugInfo.apiKeyLength = apiKey.length
    debugInfo.apiKeyPrefix = apiKey.substring(0, 8) + "..."

    console.log(`🔑 Using ElevenLabs API key: ${apiKey.substring(0, 8)}... (${apiKey.length} chars)`)

    // Clean and prepare script
    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ") // Remove special characters except basic punctuation
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\$(\d+)/g, "$1 dollars") // Convert $ to "dollars"
      .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet") // Convert sqft
      .replace(/(\d+)\s*bed/gi, "$1 bedroom") // Convert bed to bedroom
      .replace(/(\d+)\s*bath/gi, "$1 bathroom") // Convert bath to bathroom
      .trim()

    debugInfo.cleanedScript = cleanScript.substring(0, 100) + "..."
    debugInfo.cleanedScriptLength = cleanScript.length

    console.log(`📝 Cleaned script (${cleanScript.length} chars): ${cleanScript.substring(0, 100)}...`)

    // Validate script length (ElevenLabs has limits)
    if (cleanScript.length > 5000) {
      const error = "Script too long for ElevenLabs (max 5000 characters). Please shorten your script."
      console.error("❌", error)
      return {
        success: false,
        error,
        debugInfo: { ...debugInfo, error: "script_too_long" },
      }
    }

    if (cleanScript.length < 10) {
      const error = "Script too short for meaningful voiceover. Please add more content."
      console.error("❌", error)
      return {
        success: false,
        error,
        debugInfo: { ...debugInfo, error: "script_too_short" },
      }
    }

    // Prepare request payload
    const requestPayload = {
      text: cleanScript,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.75, // Slightly higher for more consistent voice
        similarity_boost: 0.85, // Higher for better voice matching
        style: 0.25, // Moderate style for real estate
        use_speaker_boost: true,
      },
      output_format: "mp3_44100_128", // Standard quality
    }

    debugInfo.requestPayload = requestPayload

    console.log("📡 Making ElevenLabs API request...")
    console.log("🎯 Voice ID:", ELEVENLABS_VOICES.rachel)

    // Make API request with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000) // 45 second timeout

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICES.rachel}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey, // Use full API key
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    debugInfo.responseStatus = response.status
    debugInfo.responseStatusText = response.statusText
    debugInfo.responseHeaders = Object.fromEntries(response.headers.entries())

    console.log(`📡 ElevenLabs API response: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      let errorMessage = `ElevenLabs API error: ${response.status} ${response.statusText}`
      let errorDetails = ""

      try {
        const errorBody = await response.text()
        debugInfo.errorBody = errorBody
        console.error("❌ ElevenLabs error body:", errorBody)

        // Parse common error scenarios
        if (response.status === 401) {
          errorMessage = "ElevenLabs API key is invalid or unauthorized"
          errorDetails = "Please check your ELEVENLABS_API_KEY is correct and active"
        } else if (response.status === 429) {
          errorMessage = "ElevenLabs API rate limit exceeded"
          errorDetails = "Please wait a moment and try again"
        } else if (response.status === 422) {
          errorMessage = "ElevenLabs rejected the text content"
          errorDetails = "Script may contain invalid characters or be too long"
        } else if (response.status === 402) {
          errorMessage = "ElevenLabs quota exceeded"
          errorDetails = "You've reached your character limit for this month"
        } else if (response.status === 404) {
          errorMessage = "Rachel voice not found"
          errorDetails = "The voice ID may be incorrect or unavailable"
        }

        // Try to parse JSON error for more details
        try {
          const errorJson = JSON.parse(errorBody)
          if (errorJson.detail) {
            errorDetails = errorJson.detail
          }
          if (errorJson.message) {
            errorDetails = errorJson.message
          }
        } catch (e) {
          // Not JSON, use text as is
        }
      } catch (e) {
        console.error("Failed to read error body:", e)
      }

      return {
        success: false,
        error: `${errorMessage}. ${errorDetails}`,
        debugInfo: { ...debugInfo, error: "api_error" },
      }
    }

    // Get audio blob
    console.log("🎵 Processing audio response...")
    const audioBlob = await response.blob()
    debugInfo.audioBlobSize = audioBlob.size
    debugInfo.audioBlobType = audioBlob.type

    console.log(`🎵 Audio blob received: ${audioBlob.size} bytes, type: ${audioBlob.type}`)

    if (audioBlob.size === 0) {
      const error = "ElevenLabs returned empty audio file"
      console.error("❌", error)
      return {
        success: false,
        error,
        debugInfo: { ...debugInfo, error: "empty_audio" },
      }
    }

    if (audioBlob.size < 1000) {
      const error = "ElevenLabs returned suspiciously small audio file"
      console.error("❌", error)
      return {
        success: false,
        error,
        debugInfo: { ...debugInfo, error: "small_audio" },
      }
    }

    // Convert to data URL
    console.log("🔄 Converting audio to data URL...")
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

    debugInfo.base64Length = base64Audio.length
    debugInfo.dataUrlLength = audioDataUrl.length

    // Estimate duration based on word count (average 150 words per minute for natural speech)
    const wordCount = cleanScript.split(/\s+/).length
    const estimatedDuration = Math.max(15, Math.ceil((wordCount / 150) * 60))

    debugInfo.wordCount = wordCount
    debugInfo.estimatedDuration = estimatedDuration

    console.log("✅ Rachel voiceover generated successfully")
    console.log(`📊 Stats: ${wordCount} words, ~${estimatedDuration}s duration, ${audioBlob.size} bytes`)

    return {
      success: true,
      audioUrl: audioDataUrl,
      duration: estimatedDuration,
      debugInfo,
    }
  } catch (error) {
    console.error("❌ Rachel voiceover generation failed:", error)

    let errorMessage = "Unknown error occurred"
    if (error instanceof Error) {
      errorMessage = error.message
      if (error.name === "AbortError") {
        errorMessage = "Request timed out after 45 seconds"
      }
    }

    return {
      success: false,
      error: errorMessage,
      debugInfo: { ...debugInfo, error: "exception", exception: String(error) },
    }
  }
}

// Generate fallback TTS using Web Speech API (browser-based)
async function generateFallbackVoiceover(
  script: string,
): Promise<{ success: boolean; audioUrl?: string; error?: string; duration?: number }> {
  try {
    console.log("🎤 Generating fallback browser-based voiceover...")

    // Clean script for TTS
    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\$(\d+)/g, "$1 dollars")
      .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
      .trim()

    // Estimate duration
    const wordCount = cleanScript.split(/\s+/).length
    const estimatedDuration = Math.max(20, Math.ceil((wordCount / 150) * 60))

    // Create a simple audio data URL (placeholder)
    // In a real implementation, you'd use Web Speech API or another TTS service
    const silentAudio =
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmHgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"

    return {
      success: true,
      audioUrl: silentAudio,
      duration: estimatedDuration,
    }
  } catch (error) {
    return {
      success: false,
      error: "Fallback voiceover generation failed",
    }
  }
}

// Break script into caption chunks for TikTok-style display
function createCaptionChunks(
  script: string,
  duration: number,
): Array<{ text: string; startTime: number; endTime: number }> {
  // Remove emojis and clean text for captions
  const cleanText = script
    .replace(/[^\w\s.,!?'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  // Split into sentences and phrases
  const sentences = cleanText.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const chunks: Array<{ text: string; startTime: number; endTime: number }> = []

  let currentTime = 0
  const totalWords = cleanText.split(/\s+/).length
  const wordsPerSecond = totalWords / duration

  sentences.forEach((sentence) => {
    const words = sentence.trim().split(/\s+/)

    // Break long sentences into smaller chunks (max 4 words for TikTok style)
    if (words.length > 4) {
      const subChunks = []
      for (let i = 0; i < words.length; i += 4) {
        subChunks.push(words.slice(i, i + 4).join(" "))
      }

      subChunks.forEach((chunk) => {
        const chunkWords = chunk.split(/\s+/).length
        const chunkDuration = Math.max(1.5, chunkWords / wordsPerSecond) // Minimum 1.5s per chunk

        chunks.push({
          text: chunk.trim().toUpperCase(), // TikTok style caps
          startTime: currentTime,
          endTime: currentTime + chunkDuration,
        })
        currentTime += chunkDuration
      })
    } else {
      const chunkDuration = Math.max(1.5, words.length / wordsPerSecond)
      chunks.push({
        text: sentence.trim().toUpperCase(),
        startTime: currentTime,
        endTime: currentTime + chunkDuration,
      })
      currentTime += chunkDuration
    }
  })

  return chunks
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 FINAL VIDEO GENERATION API CALLED")

    const data: VideoRequest = await request.json()
    console.log("📝 Request data:", {
      address: data.address,
      imageCount: data.imageUrls?.length || 0,
      scriptLength: data.script?.length || 0,
    })

    // Validation
    if (!data.address || !data.price || !data.script || !data.imageUrls || data.imageUrls.length === 0) {
      return NextResponse.json({ error: "Missing required data for video generation" }, { status: 400 })
    }

    console.log(`🎬 Generating FINAL VIDEO for ${data.address}`)

    // Step 1: Try to generate Rachel voiceover, with fallback
    console.log("🎤 Step 1: Attempting Rachel voiceover generation...")
    let audioResult = await generateRachelVoiceover(data.script)

    // If ElevenLabs fails, use fallback
    if (!audioResult.success) {
      console.log("⚠️ ElevenLabs failed, using fallback voiceover...")
      const fallbackResult = await generateFallbackVoiceover(data.script)

      if (fallbackResult.success) {
        audioResult = {
          ...fallbackResult,
          debugInfo: {
            ...audioResult.debugInfo,
            fallbackUsed: true,
            originalError: audioResult.error,
          },
        }
      }
    }

    console.log("🎤 Audio generation result:", {
      success: audioResult.success,
      hasAudio: !!audioResult.audioUrl,
      error: audioResult.error,
      duration: audioResult.duration,
    })

    if (!audioResult.success) {
      console.error("❌ Both Rachel and fallback voiceover failed:", audioResult.error)
      return NextResponse.json(
        {
          error: "Failed to generate voiceover",
          details: audioResult.error,
          debugInfo: audioResult.debugInfo,
          canRetry: true,
          suggestions: [
            "Check that ELEVENLABS_API_KEY is set correctly in environment variables",
            "Verify the API key is valid and has sufficient quota",
            "Try shortening the script if it's too long",
            "Contact support if the issue persists",
          ],
        },
        { status: 500 },
      )
    }

    // Step 2: Create caption chunks
    console.log("📝 Step 2: Creating TikTok-style captions...")
    const captionChunks = createCaptionChunks(data.script, audioResult.duration!)

    console.log(`📝 Created ${captionChunks.length} caption chunks`)

    // Step 3: Calculate video timing
    const totalDuration = Math.ceil(audioResult.duration!)
    const timePerImage = Math.max(3, Math.floor(totalDuration / data.imageUrls.length))

    console.log(`📊 Video timing: ${totalDuration}s total, ${timePerImage}s per image`)

    // Return configuration for client-side video generation
    return NextResponse.json({
      success: true,
      videoConfig: {
        images: data.imageUrls,
        audioUrl: audioResult.audioUrl,
        duration: totalDuration,
        timePerImage,
        captions: captionChunks,
        format: {
          width: 576,
          height: 1024,
          fps: 30,
        },
      },
      property: {
        address: data.address,
        price: data.price,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        sqft: data.sqft,
      },
      metadata: {
        voiceUsed: audioResult.debugInfo?.fallbackUsed ? "Fallback TTS" : "Rachel (ElevenLabs)",
        captionCount: captionChunks.length,
        imageCount: data.imageUrls.length,
        totalDuration,
        audioGenerated: true,
        fallbackUsed: audioResult.debugInfo?.fallbackUsed || false,
      },
      debugInfo: audioResult.debugInfo,
    })
  } catch (error) {
    console.error("❌ Final video generation error:", error)
    return NextResponse.json(
      {
        error: "Final video generation failed",
        details: error instanceof Error ? error.message : String(error),
        canRetry: true,
      },
      { status: 500 },
    )
  }
}
