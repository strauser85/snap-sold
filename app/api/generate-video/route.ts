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
    const propertyData: PropertyInput = await request.json()

    if (
      !propertyData.address ||
      !propertyData.price ||
      !propertyData.script ||
      !propertyData.imageUrls ||
      propertyData.imageUrls.length === 0
    ) {
      return NextResponse.json({ error: "Missing required property data" }, { status: 400 })
    }

    console.log(`🎬 Generating slideshow for ${propertyData.address}`)

    // Call canvas slideshow API
    const slideshowResponse = await fetch(`${request.nextUrl.origin}/api/canvas-slideshow`, {
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

    if (!slideshowResponse.ok) {
      const errorData = await slideshowResponse.json()
      throw new Error(errorData.error || "Slideshow preparation failed")
    }

    const slideshowData = await slideshowResponse.json()

    if (!slideshowData.success) {
      throw new Error("Slideshow configuration failed")
    }

    return NextResponse.json({
      success: true,
      method: "canvas-slideshow",
      audioUrl: slideshowData.audioUrl,
      slideshowConfig: slideshowData.slideshow,
      script: propertyData.script,
      listing: {
        address: propertyData.address,
        price: propertyData.price,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        sqft: propertyData.sqft,
      },
      metadata: {
        imageCount: propertyData.imageUrls.length,
        hasAudio: true,
        audioMethod: "elevenlabs",
      },
    })
  } catch (error) {
    console.error("❌ Video generation error:", error)
    return NextResponse.json(
      {
        error: "Video generation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
