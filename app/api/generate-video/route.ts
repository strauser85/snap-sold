import { type NextRequest, NextResponse } from "next/server"

interface PropertyInput {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription?: string
  script: string
  imageUrls: string[]
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 VIDEO GENERATION API CALLED")

    const propertyData: PropertyInput = await request.json()
    console.log("📝 Request data received:", {
      address: propertyData.address,
      imageCount: propertyData.imageUrls?.length || 0,
      scriptLength: propertyData.script?.length || 0,
    })

    // Validate required data
    if (
      !propertyData.address ||
      !propertyData.price ||
      !propertyData.script ||
      !propertyData.imageUrls ||
      propertyData.imageUrls.length === 0
    ) {
      console.error("❌ Missing required data")
      return NextResponse.json(
        {
          error: "Missing required property data",
          details: "Address, price, script, and at least one image are required",
        },
        { status: 400 },
      )
    }

    console.log("✅ Data validation passed")

    // Call ElevenLabs slideshow API
    console.log("🎤 Calling ElevenLabs slideshow API...")

    const slideshowResponse = await fetch(`${request.nextUrl.origin}/api/elevenlabs-slideshow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrls: propertyData.imageUrls,
        script: propertyData.script,
        propertyData: {
          address: propertyData.address,
          price: propertyData.price,
          bedrooms: propertyData.bedrooms,
          bathrooms: propertyData.bathrooms,
          sqft: propertyData.sqft,
          propertyDescription: propertyData.propertyDescription,
        },
      }),
    })

    console.log("📡 Slideshow API response:", slideshowResponse.status)

    if (!slideshowResponse.ok) {
      const errorData = await slideshowResponse.json()
      console.error("❌ Slideshow API error:", errorData)
      throw new Error(errorData.error || "ElevenLabs slideshow preparation failed")
    }

    const slideshowData = await slideshowResponse.json()
    console.log("✅ Slideshow data received:", {
      hasAudio: !!slideshowData.audioUrl,
      imageCount: slideshowData.slideshow?.images?.length || 0,
    })

    if (!slideshowData.success) {
      throw new Error("ElevenLabs slideshow configuration failed")
    }

    console.log("🎉 Video generation setup completed successfully")

    return NextResponse.json({
      success: true,
      method: "elevenlabs-slideshow",
      audioUrl: slideshowData.audioUrl,
      slideshowConfig: slideshowData.slideshow,
      script: propertyData.script,
      listing: {
        address: propertyData.address,
        price: propertyData.price,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        sqft: propertyData.sqft,
        customFeatures: propertyData.propertyDescription || null,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        format: "ElevenLabs Slideshow (9:16)",
        imageCount: propertyData.imageUrls.length,
        timePerImage: slideshowData.slideshow.timePerImage,
        totalDuration: slideshowData.slideshow.totalDuration,
        hasAudio: true,
        audioMethod: "elevenlabs",
        allImagesUsed: true,
      },
    })
  } catch (error) {
    console.error("❌ VIDEO GENERATION ERROR:", error)

    return NextResponse.json(
      {
        error: "Video generation failed",
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
