import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 Simple video generation API called")

    const body = await request.json()
    console.log("📝 Request body received:", Object.keys(body))

    // Basic validation
    if (!body.address || !body.script || !body.imageUrls || body.imageUrls.length === 0) {
      console.error("❌ Missing required fields")
      return NextResponse.json({ error: "Missing required fields: address, script, and imageUrls" }, { status: 400 })
    }

    console.log(`✅ Validation passed: ${body.imageUrls.length} images, script length: ${body.script.length}`)

    // Generate ElevenLabs audio
    let audioUrl = ""
    try {
      console.log("🎤 Generating ElevenLabs audio...")

      if (!process.env.ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key not configured")
      }

      const cleanScript = body.script
        .replace(/[^\w\s.,!?'-]/g, " ")
        .replace(/\s+/g, " ")
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
          },
        }),
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const arrayBuffer = await audioBlob.arrayBuffer()
        const base64Audio = Buffer.from(arrayBuffer).toString("base64")
        audioUrl = `data:audio/mpeg;base64,${base64Audio}`
        console.log("✅ ElevenLabs audio generated successfully")
      } else {
        console.log("⚠️ ElevenLabs failed, continuing without audio")
      }
    } catch (error) {
      console.log("⚠️ Audio generation failed:", error)
    }

    // Calculate timing
    const wordCount = body.script.split(" ").length
    const estimatedDuration = Math.max(30, wordCount * 0.5)
    const timePerImage = Math.max(3, Math.floor(estimatedDuration / body.imageUrls.length))
    const totalDuration = body.imageUrls.length * timePerImage

    console.log(`📊 Timing calculated: ${timePerImage}s per image, ${totalDuration}s total`)

    // Return success response
    return NextResponse.json({
      success: true,
      slideshowConfig: {
        images: body.imageUrls,
        timePerImage,
        totalDuration,
        audioUrl,
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
      },
    })
  } catch (error) {
    console.error("❌ Video generation API error:", error)

    return NextResponse.json(
      {
        error: "Video generation setup failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
