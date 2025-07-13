import { type NextRequest, NextResponse } from "next/server"

interface ImageAnalysisRequest {
  imageUrls: string[]
  script: string
}

interface ImageAnalysis {
  url: string
  roomType: string
  features: string[]
  description: string
  confidence: number
  suggestedOrder: number
}

// Analyze images using OpenAI Vision API
async function analyzeImageWithOpenAI(imageUrl: string): Promise<Omit<ImageAnalysis, "url" | "suggestedOrder">> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a real estate photography expert. Analyze property images and classify them for slideshow organization.

Return a JSON object with:
- roomType: "exterior_front", "exterior_back", "kitchen", "living_room", "dining_room", "master_bedroom", "bedroom", "bathroom", "garage", "pool", "yard", "other"
- features: Array of specific features you see (e.g., ["granite_countertops", "stainless_appliances", "hardwood_floors"])
- description: Brief description of what makes this space appealing
- confidence: Number 0-1 indicating how confident you are in the classification

Focus on identifying the room type and key selling features that would be mentioned in a real estate listing.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this property image and classify it for a real estate slideshow:",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                  detail: "low", // Use low detail to save costs
                },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI Vision API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parse JSON response
    try {
      const analysis = JSON.parse(content)
      return {
        roomType: analysis.roomType || "other",
        features: analysis.features || [],
        description: analysis.description || "Property image",
        confidence: analysis.confidence || 0.5,
      }
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return {
        roomType: "other",
        features: [],
        description: "Property image",
        confidence: 0.3,
      }
    }
  } catch (error) {
    console.error("OpenAI Vision analysis failed:", error)
    return {
      roomType: "other",
      features: [],
      description: "Property image",
      confidence: 0.1,
    }
  }
}

// Analyze script to determine optimal image order
function analyzeScriptForImageOrder(script: string): string[] {
  const scriptLower = script.toLowerCase()

  // Define script sections and their typical order
  const sectionKeywords = {
    exterior_front: ["welcome", "stunning", "beautiful home", "property", "house", "curb appeal"],
    kitchen: ["kitchen", "cook", "granite", "appliances", "cabinets", "dining"],
    living_room: ["living", "family room", "great room", "entertaining", "spacious"],
    dining_room: ["dining", "formal dining", "eat"],
    master_bedroom: ["master", "primary bedroom", "suite"],
    bedroom: ["bedroom", "bed", "sleep"],
    bathroom: ["bathroom", "bath", "spa", "shower"],
    exterior_back: ["backyard", "pool", "deck", "patio", "outdoor", "garden"],
    garage: ["garage", "parking", "car"],
    yard: ["yard", "landscaping", "garden"],
    pool: ["pool", "swim", "spa"],
    other: [],
  }

  // Score each room type based on script mentions
  const roomScores: { [key: string]: number } = {}

  Object.entries(sectionKeywords).forEach(([roomType, keywords]) => {
    let score = 0
    keywords.forEach((keyword) => {
      const matches = (scriptLower.match(new RegExp(keyword, "g")) || []).length
      score += matches
    })
    roomScores[roomType] = score
  })

  // Define ideal order for real estate slideshows
  const idealOrder = [
    "exterior_front",
    "living_room",
    "kitchen",
    "dining_room",
    "master_bedroom",
    "bedroom",
    "bathroom",
    "exterior_back",
    "pool",
    "yard",
    "garage",
    "other",
  ]

  // Filter to only include room types mentioned in script or with high scores
  return idealOrder.filter(
    (roomType) => roomScores[roomType] > 0 || roomType === "exterior_front" || roomType === "other",
  )
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, script }: ImageAnalysisRequest = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    console.log(`🔍 Analyzing ${imageUrls.length} images for smart arrangement`)

    // Analyze each image
    const imageAnalyses: ImageAnalysis[] = []

    for (let i = 0; i < imageUrls.length; i++) {
      console.log(`Analyzing image ${i + 1}/${imageUrls.length}`)

      const analysis = await analyzeImageWithOpenAI(imageUrls[i])

      imageAnalyses.push({
        url: imageUrls[i],
        suggestedOrder: 0, // Will be set below
        ...analysis,
      })

      // Small delay to avoid rate limiting
      if (i < imageUrls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    console.log("✅ All images analyzed")

    // Analyze script to determine optimal order
    const scriptOrder = analyzeScriptForImageOrder(script)
    console.log("📝 Script analysis complete, optimal order:", scriptOrder)

    // Group images by room type
    const imagesByRoom: { [key: string]: ImageAnalysis[] } = {}
    imageAnalyses.forEach((analysis) => {
      if (!imagesByRoom[analysis.roomType]) {
        imagesByRoom[analysis.roomType] = []
      }
      imagesByRoom[analysis.roomType].push(analysis)
    })

    // Sort images within each room type by confidence
    Object.keys(imagesByRoom).forEach((roomType) => {
      imagesByRoom[roomType].sort((a, b) => b.confidence - a.confidence)
    })

    // Arrange images according to script order
    const arrangedImages: ImageAnalysis[] = []
    let orderIndex = 0

    scriptOrder.forEach((roomType) => {
      if (imagesByRoom[roomType]) {
        imagesByRoom[roomType].forEach((image) => {
          image.suggestedOrder = orderIndex++
          arrangedImages.push(image)
        })
        delete imagesByRoom[roomType] // Remove processed room
      }
    })

    // Add any remaining images that didn't match script sections
    Object.values(imagesByRoom)
      .flat()
      .forEach((image) => {
        image.suggestedOrder = orderIndex++
        arrangedImages.push(image)
      })

    console.log(`✅ Images arranged: ${arrangedImages.length} total`)

    return NextResponse.json({
      success: true,
      originalOrder: imageUrls,
      arrangedImages: arrangedImages,
      scriptSections: scriptOrder,
      summary: {
        totalImages: imageUrls.length,
        roomTypes: Object.keys(imagesByRoom).length + scriptOrder.length,
        averageConfidence: imageAnalyses.reduce((sum, img) => sum + img.confidence, 0) / imageAnalyses.length,
      },
    })
  } catch (error) {
    console.error("Image analysis error:", error)
    return NextResponse.json(
      {
        error: "Image analysis failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
