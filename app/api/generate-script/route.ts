import { type NextRequest, NextResponse } from "next/server"

interface PropertyData {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  imageCount?: number
}

// Fallback script templates for when AI fails
const generateFallbackScript = (data: PropertyData): string => {
  const { address, price, bedrooms, bathrooms, sqft, imageCount = 1 } = data

  const priceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price)

  const hooks = [
    "🚨 This property is about to BLOW YOUR MIND! 🚨",
    "⚡ STOP SCROLLING! You need to see this house! ⚡",
    "🔥 This is why I LOVE real estate! Look at this! 🔥",
    "💰 Want to see a MILLION DOLLAR opportunity? 💰",
    "🏠 This house is absolutely STUNNING! Here's why... 🏠",
  ]

  const midSections = [
    `We've got ${bedrooms} spacious bedrooms and ${bathrooms} beautiful bathrooms spread across ${sqft.toLocaleString()} square feet of pure luxury!`,
    `${bedrooms} beds, ${bathrooms} baths, and ${sqft.toLocaleString()} sq ft of absolute perfection!`,
    `This ${bedrooms}-bedroom, ${bathrooms}-bathroom masterpiece offers ${sqft.toLocaleString()} square feet of dream living!`,
  ]

  const endings = [
    "Don't let this opportunity slip away! DM me NOW! 📱✨",
    "This won't last long at this price! Contact me TODAY! 🏃‍♂️💨",
    "Ready to make this YOUR home? Let's talk! 📞🔥",
    "Investment opportunity of a lifetime! Call me! 💎📈",
  ]

  const hook = hooks[Math.floor(Math.random() * hooks.length)]
  const middle = midSections[Math.floor(Math.random() * midSections.length)]
  const ending = endings[Math.floor(Math.random() * endings.length)]

  let script = `${hook}\n\n`
  script += `Welcome to ${address}! `
  script += `${middle}\n\n`
  script += `Priced at ${priceFormatted}, this property is an incredible opportunity! `

  if (imageCount > 5) {
    script += `And with ${imageCount} stunning photos, you can see every amazing detail! `
  }

  script += `${ending}`

  return script
}

export async function POST(request: NextRequest) {
  try {
    const propertyData: PropertyData = await request.json()

    console.log("Generating script for:", propertyData.address)

    // Try AI generation first (if available)
    try {
      // Check if we have AI SDK available
      const { generateText } = await import("ai")
      const { openai } = await import("@ai-sdk/openai")

      const { address, price, bedrooms, bathrooms, sqft, imageCount = 1 } = propertyData

      const { text: script } = await generateText({
        model: openai("gpt-4o"),
        system: `You are a top real estate marketing expert who creates viral TikTok scripts. Create engaging, persuasive voiceover scripts for property videos that:

1. Hook viewers in the first 3 seconds with a compelling question or statement
2. Use urgency and scarcity tactics ("This won't last long!")
3. Highlight key selling points and lifestyle benefits
4. Include emotional triggers and investment potential
5. Reference multiple property features since we have ${imageCount} images to showcase
6. End with a strong call-to-action
7. Are 45-60 seconds when spoken (about 150-200 words for ${imageCount} images)
8. Use casual, energetic TikTok language with strategic pauses
9. Include relevant emojis and power words
10. Create anticipation for each room/feature reveal

The script should feel authentic and exciting, not salesy. Focus on lifestyle transformation and investment opportunity.`,
        prompt: `Create a viral TikTok voiceover script for this property with ${imageCount} images:

Address: ${address}
Price: $${price.toLocaleString()}
Bedrooms: ${bedrooms}
Bathrooms: ${bathrooms}
Square Feet: ${sqft.toLocaleString()}
Images Available: ${imageCount} photos

Make it compelling for potential buyers and investors with hooks, benefits, urgency, and strong call-to-action.`,
      })

      console.log("AI script generated successfully")
      return NextResponse.json({
        success: true,
        script: script.trim(),
        method: "AI",
      })
    } catch (aiError) {
      console.log("AI generation failed, using fallback:", aiError)

      // Use fallback script generation
      const fallbackScript = generateFallbackScript(propertyData)

      console.log("Fallback script generated successfully")
      return NextResponse.json({
        success: true,
        script: fallbackScript,
        method: "fallback",
      })
    }
  } catch (error) {
    console.error("Script generation error:", error)

    // Last resort - basic template
    const basicScript = `🏡 Welcome to this amazing property! This stunning home features ${request.body ? "multiple" : ""} bedrooms and bathrooms with incredible living space. Don't miss this opportunity! Contact me today! 📞✨`

    return NextResponse.json({
      success: true,
      script: basicScript,
      method: "basic",
    })
  }
}
