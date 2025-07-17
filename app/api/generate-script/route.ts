import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount } = await request.json()

    // Create fallback script with proper pronunciation
    const bedroomsText = bedrooms === 1 ? "bedroom" : "bedrooms"
    const bathroomsText = bathrooms === 1 ? "bathroom" : "bathrooms"

    // Clean address for pronunciation
    const cleanAddress = address
      .replace(/\bDr\b/g, "Drive")
      .replace(/\bSt\b/g, "Street")
      .replace(/\bAve\b/g, "Avenue")
      .replace(/\bBlvd\b/g, "Boulevard")
      .replace(/\bRd\b/g, "Road")
      .replace(/\bLn\b/g, "Lane")
      .replace(/\bCt\b/g, "Court")

    let script = `Stop scrolling! This property is about to blow your mind!

Welcome to ${cleanAddress}! This stunning home features ${bedrooms} ${bedroomsText} and ${bathrooms} ${bathroomsText}, with ${sqft.toLocaleString()} square feet of pure luxury!`

    if (propertyDescription && propertyDescription.trim()) {
      script += `

But wait, there's more! ${propertyDescription.trim()}`
    }

    script += `

Priced at ${price.toLocaleString()} dollars, this property is an incredible opportunity! Don't let this slip away! Message me now!`

    // Try OpenAI if available
    try {
      if (process.env.OPENAI_API_KEY) {
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content:
                  "You are a real estate marketing expert. Create engaging TikTok scripts that sell properties fast. Use proper pronunciation for street abbreviations (Dr = Drive, St = Street, etc). Keep it under 30 seconds when spoken.",
              },
              {
                role: "user",
                content: `Create a viral TikTok script for: ${cleanAddress}, ${bedrooms} ${bedroomsText}, ${bathrooms} ${bathroomsText}, ${sqft} sqft, $${price}. Features: ${propertyDescription || "Standard features"}. Make it exciting and sales-focused!`,
              },
            ],
            max_tokens: 300,
            temperature: 0.8,
          }),
        })

        if (openaiResponse.ok) {
          const data = await openaiResponse.json()
          const aiScript = data.choices[0]?.message?.content?.trim()
          if (aiScript && aiScript.length > 50) {
            return NextResponse.json({
              script: aiScript,
              method: "OpenAI",
            })
          }
        }
      }
    } catch (error) {
      console.warn("OpenAI failed, using fallback:", error)
    }

    return NextResponse.json({
      script,
      method: "Template",
    })
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json(
      {
        error: "Script generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
