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
      return NextResponse.json({ error: "Missing required property data." }, { status: 400 })
    }

    console.log(`🎬 CANVAS SLIDESHOW GENERATION (DEFAULT)`)
    console.log(`📍 Property: ${propertyData.address}`)
    console.log(`🖼️ Images: ${propertyData.imageUrls.length} (ALL WILL BE USED)`)
    console.log(`📝 Script: ${propertyData.script.length} characters`)

    // Call Canvas slideshow API
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
      throw new Error(errorData.error || "Canvas slideshow preparation failed")
    }

    const slideshowData = await slideshowResponse.json()

    if (!slideshowData.success) {
      throw new Error("Canvas slideshow configuration failed")
    }

    console.log("✅ Canvas slideshow configuration ready")

    return NextResponse.json({
      success: true,
      method: "canvas-slideshow",
      audioUrl: slideshowData.audioUrl,
      audioError: slideshowData.audioError,
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
        format: "Canvas Slideshow (9:16) - ALL IMAGES",
        imageCount: propertyData.imageUrls.length,
        timePerImage: `${slideshowData.slideshow.timePerImage} seconds`,
        totalDuration: `${slideshowData.slideshow.totalDuration} seconds`,
        wordCount: propertyData.script.split(" ").length,
        hasAudio: !!slideshowData.audioUrl,
        hasCustomFeatures: !!propertyData.propertyDescription,
        slideshowType: `Canvas Slideshow - ALL ${propertyData.imageUrls.length} Photos`,
        method: "canvas-slideshow",
        allImagesUsed: true,
        reliable: true,
        cost: "free",
      },
    })
  } catch (error) {
    console.error("❌ CANVAS SLIDESHOW ERROR:", error)

    return NextResponse.json(
      {
        error: "Canvas slideshow generation failed.",
        details: error instanceof Error ? error.message : String(error),
        method: "canvas-slideshow",
      },
      { status: 500 },
    )
  }
}
