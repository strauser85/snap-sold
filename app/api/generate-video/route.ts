import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 Video generation API called")

    const body = await request.json()
    console.log("📝 Request received:", {
      address: body.address,
      imageCount: body.imageUrls?.length || 0,
      scriptLength: body.script?.length || 0,
    })

    // Validation
    if (!body.address || !body.script || !body.imageUrls || body.imageUrls.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Generate ElevenLabs audio with better error handling
    let audioUrl = ""
    let audioError = null

    try {
      if (process.env.ELEVENLABS_API_KEY) {
        console.log("🎤 Generating ElevenLabs audio...")

        const cleanScript = body.script
          .replace(/[^\w\s.,!?'-]/g, " ")
          .replace(/\s+/g, " ")
          .replace(/\$(\d+)/g, "$1 dollars")
          .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
          .trim()

        const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text: cleanScript,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.6,
              similarity_boost: 0.8,
              style: 0.2,
            },
            output_format: "mp3_44100_128",
          }),
        })

        if (response.ok) {
          const audioBlob = await response.blob()
          if (audioBlob.size > 0) {
            const arrayBuffer = await audioBlob.arrayBuffer()
            const base64Audio = Buffer.from(arrayBuffer).toString("base64")
            audioUrl = `data:audio/mpeg;base64,${base64Audio}`
            console.log("✅ ElevenLabs audio generated successfully")
          } else {
            throw new Error("Empty audio response")
          }
        } else {
          const errorText = await response.text()
          throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
        }
      } else {
        throw new Error("ElevenLabs API key not configured")
      }
    } catch (error) {
      console.error("❌ ElevenLabs audio failed:", error)
      audioError = error instanceof Error ? error.message : "Audio generation failed"
    }

    // Calculate timing
    const wordCount = body.script.split(" ").length
    const estimatedDuration = Math.max(30, wordCount * 0.5)
    const timePerImage = Math.max(3, Math.floor(estimatedDuration / body.imageUrls.length))
    const totalDuration = body.imageUrls.length * timePerImage

    console.log(`📊 Timing: ${timePerImage}s per image, ${totalDuration}s total`)

    return NextResponse.json({
      success: true,
      slideshowConfig: {
        images: body.imageUrls,
        timePerImage,
        totalDuration,
        audioUrl,
        audioError,
        format: {
          width: 576,
          height: 1024,
          fps: 30,
        },
      },
      script: body.script,
      listing: {
        address: body.address,
        price: body.price,
      },
      metadata: {
        imageCount: body.imageUrls.length,
        hasAudio: !!audioUrl,
        audioMethod: audioUrl ? "elevenlabs" : "none",
      },
    })
  } catch (error) {
    console.error("❌ API error:", error)
    return NextResponse.json(
      {
        error: "Video generation setup failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
