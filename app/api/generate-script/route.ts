import { type NextRequest, NextResponse } from "next/server"

interface PropertyData {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription?: string
  imageCount?: number
}

// Comprehensive script sanitization filter
function sanitizeGeneratedScript(script: string): string {
  console.log("🧹 Applying final script sanitization filter...")
  console.log("📝 Original length:", script.length)

  let cleaned = script

  // Step 1: Remove all emojis and Unicode symbols (comprehensive)
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, "") // Emoticons
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, "") // Misc Symbols and Pictographs
  cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, "") // Transport and Map
  cleaned = cleaned.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "") // Regional indicator symbols
  cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, "") // Misc symbols
  cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, "") // Dingbats
  cleaned = cleaned.replace(/[\u{1F900}-\u{1F9FF}]/gu, "") // Supplemental Symbols and Pictographs
  cleaned = cleaned.replace(/[\u{1FA70}-\u{1FAFF}]/gu, "") // Symbols and Pictographs Extended-A
  cleaned = cleaned.replace(/[\u{FE00}-\u{FE0F}]/gu, "") // Variation Selectors
  cleaned = cleaned.replace(/[\u{1F000}-\u{1F02F}]/gu, "") // Mahjong Tiles
  cleaned = cleaned.replace(/[\u{1F0A0}-\u{1F0FF}]/gu, "") // Playing Cards

  // Step 2: Remove specific problematic characters
  cleaned = cleaned.replace(/[🏠🚨💰📱✨🔥⚡💎📈🏃‍♂️💨📞🎵♪]/gu, "")
  cleaned = cleaned.replace(/[🎬📊📍🖼️📝⏱️🎤🧹]/gu, "")
  cleaned = cleaned.replace(/[✅❌⚠️🎯🔧📦🔍📡]/gu, "")

  // Step 3: Replace smart quotes and special punctuation
  cleaned = cleaned.replace(/[""]/g, '"') // Smart double quotes
  cleaned = cleaned.replace(/['']/g, "'") // Smart single quotes
  cleaned = cleaned.replace(/[–—]/g, "-") // Em dash, en dash
  cleaned = cleaned.replace(/[…]/g, "...") // Ellipsis
  cleaned = cleaned.replace(/[«»]/g, '"') // Guillemets

  // Step 4: Remove symbols and replace with words
  cleaned = cleaned.replace(/[®©™]/g, "") // Trademark symbols
  cleaned = cleaned.replace(/[°]/g, " degrees ") // Degree symbol
  cleaned = cleaned.replace(/[±]/g, " plus or minus ") // Plus-minus
  cleaned = cleaned.replace(/[×]/g, " times ") // Multiplication
  cleaned = cleaned.replace(/[÷]/g, " divided by ") // Division

  // Step 5: Handle currency symbols
  cleaned = cleaned.replace(/\$/g, " dollars ") // Dollar signs
  cleaned = cleaned.replace(/[¢]/g, " cents ") // Cents
  cleaned = cleaned.replace(/[£]/g, " pounds ") // British pounds
  cleaned = cleaned.replace(/[€]/g, " euros ") // Euros

  // Step 6: Remove bullet points and special formatting
  cleaned = cleaned.replace(/[•·]/g, "and") // Bullet points
  cleaned = cleaned.replace(/[▪▫]/g, "") // Square bullets
  cleaned = cleaned.replace(/[►▶]/g, "") // Arrow bullets
  cleaned = cleaned.replace(/[★☆]/g, "") // Stars

  // Step 7: Remove hashtags and @ mentions
  cleaned = cleaned.replace(/#\w+/g, "") // Hashtags
  cleaned = cleaned.replace(/@\w+/g, "") // @ mentions

  // Step 8: Remove remaining non-ASCII characters (keep basic accented letters)
  cleaned = cleaned.replace(/[^\x20-\x7E\u00C0-\u00FF]/g, " ")

  // Step 9: Clean up spacing and punctuation
  cleaned = cleaned.replace(/\s+/g, " ") // Normalize whitespace
  cleaned = cleaned.replace(/\s+([.,!?])/g, "$1") // Fix spacing before punctuation
  cleaned = cleaned.replace(/([.,!?])\s*([.,!?])/g, "$1 $2") // Fix multiple punctuation
  cleaned = cleaned.replace(/\.([A-Za-z])/g, ". $1") // Space after periods
  cleaned = cleaned.replace(/!([A-Za-z])/g, "! $1") // Space after exclamations
  cleaned = cleaned.replace(/\?([A-Za-z])/g, "? $1") // Space after questions

  // Step 10: Final cleanup
  cleaned = cleaned.trim()

  console.log("✅ Script sanitization complete")
  console.log("📝 Cleaned length:", cleaned.length)
  console.log("🔍 Sample cleaned text:", cleaned.substring(0, 100) + "...")

  return cleaned
}

// Fallback script templates for when AI fails (emoji-free)
const generateFallbackScript = (data: PropertyData): string => {
  const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount = 1 } = data

  const priceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price)

  const hooks = [
    "STOP SCROLLING! This property is about to BLOW YOUR MIND!",
    "You need to see this house! This is why I LOVE real estate!",
    "Want to see a MILLION DOLLAR opportunity? Look at this!",
    "This house is absolutely STUNNING! Here's why you need to see it.",
    "ATTENTION home buyers! This property won't last long!",
  ]

  const midSections = [
    `We've got ${bedrooms} spacious bedrooms and ${bathrooms} beautiful bathrooms spread across ${sqft.toLocaleString()} square feet of pure luxury!`,
    `${bedrooms} beds, ${bathrooms} baths, and ${sqft.toLocaleString()} square feet of absolute perfection!`,
    `This ${bedrooms}-bedroom, ${bathrooms}-bathroom masterpiece offers ${sqft.toLocaleString()} square feet of dream living!`,
  ]

  const endings = [
    "Don't let this opportunity slip away! DM me NOW!",
    "This won't last long at this price! Contact me TODAY!",
    "Ready to make this YOUR home? Let's talk!",
    "Investment opportunity of a lifetime! Call me!",
  ]

  const hook = hooks[Math.floor(Math.random() * hooks.length)]
  const middle = midSections[Math.floor(Math.random() * midSections.length)]
  const ending = endings[Math.floor(Math.random() * endings.length)]

  let script = `${hook}\n\n`
  script += `Welcome to ${address}! `
  script += `${middle}\n\n`

  // Include property description if provided
  if (propertyDescription && propertyDescription.trim()) {
    script += `But wait, there's more! ${propertyDescription.trim()}\n\n`
  }

  script += `Priced at ${priceFormatted}, this property is an incredible opportunity! `

  if (imageCount > 5) {
    script += `And with ${imageCount} stunning photos, you can see every amazing detail! `
  }

  script += `${ending}`

  // Apply sanitization filter to fallback script too
  return sanitizeGeneratedScript(script)
}

// OpenAI API function with updated prompt
async function generateOpenAIScript(propertyData: PropertyData): Promise<string> {
  const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount = 1 } = propertyData

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
          content: `You are a top real estate marketing expert who creates viral TikTok scripts. Create engaging, persuasive voiceover scripts for property videos.

CRITICAL REQUIREMENTS - FOLLOW EXACTLY:
1. Use ONLY plain English text - NO emojis, symbols, or special characters
2. Use ONLY standard ASCII punctuation: periods, commas, exclamation marks, question marks
3. NO Unicode symbols, emojis, or special formatting characters
4. NO hashtags, @ mentions, or social media symbols
5. NO bullet points, arrows, or decorative characters
6. Use words instead of symbols (write "dollars" not "$", "and" not "&")

SCRIPT REQUIREMENTS:
- Hook viewers in the first 3 seconds with a compelling question or statement
- Use urgency and scarcity tactics ("This won't last long!")
- Highlight key selling points and lifestyle benefits
- Include emotional triggers and investment potential
- Reference multiple property features since we have ${imageCount} images to showcase
- IMPORTANTLY: Incorporate any custom property description/features provided by the user naturally into the script
- End with a strong call-to-action
- Are 45-60 seconds when spoken (about 150-200 words for ${imageCount} images)
- Use casual, energetic TikTok language with strategic pauses
- Include relevant power words and create anticipation for each room/feature reveal

The script should feel authentic and exciting, not salesy. Focus on lifestyle transformation and investment opportunity. If custom property details are provided, weave them seamlessly into the narrative to highlight what makes this property unique.

REMEMBER: Use ONLY plain text with standard punctuation. NO emojis or special characters whatsoever.`,
        },
        {
          role: "user",
          content: `Create a viral TikTok voiceover script for this property with ${imageCount} images. Use ONLY plain English text with standard punctuation - NO emojis or special characters.

Address: ${address}
Price: $${price.toLocaleString()}
Bedrooms: ${bedrooms}
Bathrooms: ${bathrooms}
Square Feet: ${sqft.toLocaleString()}
Images Available: ${imageCount} photos

${
  propertyDescription && propertyDescription.trim()
    ? `IMPORTANT - Custom Property Features to Highlight:
${propertyDescription.trim()}

Please incorporate these specific features and details naturally into the script to emphasize what makes this property special.`
    : ""
}

Make it compelling for potential buyers and investors with hooks, benefits, urgency, and strong call-to-action. Use ONLY plain text - absolutely NO emojis, symbols, or special characters.`,
        },
      ],
      max_tokens: 500,
      temperature: 0.8,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const rawScript = data.choices[0].message.content.trim()

  // Apply sanitization filter to AI-generated script
  return sanitizeGeneratedScript(rawScript)
}

export async function POST(request: NextRequest) {
  try {
    const propertyData: PropertyData = await request.json()

    console.log("Generating emoji-free script for:", propertyData.address)
    if (propertyData.propertyDescription) {
      console.log("Including custom property description:", propertyData.propertyDescription.substring(0, 100) + "...")
    }

    // First try OpenAI API if key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log("Using OpenAI API for emoji-free script generation...")
        const script = await generateOpenAIScript(propertyData)

        console.log("OpenAI emoji-free script generated successfully")
        console.log("Sample output:", script.substring(0, 100) + "...")

        return NextResponse.json({
          success: true,
          script: script,
          method: "OpenAI (emoji-free)",
        })
      } catch (aiError) {
        console.log("OpenAI API failed, using fallback:", aiError)
      }
    } else {
      console.log("No OpenAI API key found, using fallback")
    }

    // Use fallback script generation (already emoji-free)
    const fallbackScript = generateFallbackScript(propertyData)

    console.log("Fallback emoji-free script generated successfully")
    console.log("Sample output:", fallbackScript.substring(0, 100) + "...")

    return NextResponse.json({
      success: true,
      script: fallbackScript,
      method: "fallback (emoji-free)",
    })
  } catch (error) {
    console.error("Script generation error:", error)

    // Last resort - basic template (emoji-free)
    const basicScript = sanitizeGeneratedScript(
      `Welcome to this amazing property! This stunning home features multiple bedrooms and bathrooms with incredible living space. Don't miss this opportunity! Contact me today!`,
    )

    return NextResponse.json({
      success: true,
      script: basicScript,
      method: "basic (emoji-free)",
    })
  }
}
