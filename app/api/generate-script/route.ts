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

// Comprehensive script sanitization for JSON and TTS safety
function sanitizeScript(text: string): string {
  console.log("🧹 Sanitizing script for JSON/TTS safety...")
  console.log("📝 Original text length:", text.length)
  console.log("🔍 Original sample:", text.substring(0, 100))

  const sanitized = text
    // Remove ALL non-ASCII characters (emojis, symbols, etc.)
    .replace(/[^\x00-\x7F]/g, "")
    // Replace smart quotes with normal quotes
    .replace(/[""'']/g, '"')
    // Replace em-dashes and en-dashes with hyphens
    .replace(/[—–]/g, "-")
    // Replace ellipsis with three periods
    .replace(/…/g, "...")
    // Remove any remaining problematic characters
    .replace(/[^\x20-\x7E]/g, " ")
    // Clean up multiple spaces
    .replace(/\s+/g, " ")
    // Trim whitespace
    .trim()

  console.log("✅ Sanitized text length:", sanitized.length)
  console.log("🔍 Sanitized sample:", sanitized.substring(0, 100))

  return sanitized
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

// Fallback script templates with perfect grammar and no abbreviations
const generateFallbackScript = (data: PropertyData): string => {
  const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount = 1 } = data

  const priceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price)

  const hooks = [
    "Stop scrolling! This property is about to blow your mind!",
    "You need to see this house! This is why I love real estate!",
    "Want to see a million dollar opportunity? Look at this!",
    "This house is absolutely stunning! Here is why you need to see it.",
    "Attention home buyers! This property will not last long!",
  ]

  const midSections = [
    `We have ${bedrooms} spacious bedrooms and ${bathrooms} beautiful bathrooms spread across ${sqft.toLocaleString()} square feet of pure luxury!`,
    `${bedrooms} bedrooms, ${bathrooms} bathrooms, and ${sqft.toLocaleString()} square feet of absolute perfection!`,
    `This ${bedrooms}-bedroom, ${bathrooms}-bathroom masterpiece offers ${sqft.toLocaleString()} square feet of dream living!`,
  ]

  const endings = [
    "Do not let this opportunity slip away! Direct message me now!",
    "This will not last long at this price! Contact me today!",
    "Ready to make this your home? Let us talk!",
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
    script += `But wait, there is more! ${propertyDescription.trim()}\n\n`
  }

  script += `Priced at ${priceFormatted}, this property is an incredible opportunity! `

  if (imageCount > 5) {
    script += `And with ${imageCount} stunning photos, you can see every amazing detail! `
  }

  script += `${ending}`

  // Apply grammar fixes to fallback script too
  return sanitizeAndFixGrammar(script)
}

// OpenAI API function with improved prompt for perfect grammar and no abbreviations
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
          content: `You are a professional real estate marketing expert who creates viral TikTok scripts with PERFECT grammar and NO abbreviations.

CRITICAL WRITING RULES - FOLLOW EXACTLY:
- Use PERFECT grammar, spelling, and punctuation
- NEVER use abbreviations (write "bedrooms" not "BR", "bathrooms" not "BA", "square feet" not "sqft")
- Write out ALL numbers as words when under 10 (write "three" not "3")
- Use complete sentences with proper structure
- No emojis, special characters, or symbols
- Use "dollars" instead of "$" symbol
- Write "and" instead of "&" symbol
- Use proper capitalization and sentence structure
- Every sentence must be grammatically perfect

SCRIPT REQUIREMENTS:
- Hook viewers in first 3 seconds with compelling opening
- Use urgency and scarcity language naturally
- Highlight key selling points and lifestyle benefits
- Include emotional triggers and investment potential
- Reference property features for ${imageCount} images
- Incorporate custom property descriptions naturally
- End with strong call-to-action
- 45-60 seconds when spoken (150-200 words)
- Energetic but professional TikTok language
- Create anticipation for room reveals

GRAMMAR EXAMPLES:
- Write "This three-bedroom, two-bathroom home" not "This 3BR/2BA home"
- Write "two thousand five hundred square feet" not "2500 sqft"
- Write "five hundred thousand dollars" not "$500K"
- Write "Do not miss this opportunity" not "Don't miss this"

Create a script with PERFECT grammar and NO abbreviations whatsoever.`,
        },
        {
          role: "user",
          content: `Create a viral TikTok voiceover script with PERFECT grammar and NO abbreviations for this property with ${imageCount} images.

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

Please incorporate these specific features naturally into the script with perfect grammar.`
    : ""
}

Requirements:
- Use PERFECT grammar and complete sentences
- Write "bedrooms" and "bathrooms" in full (never BR/BA)
- Write numbers under 10 as words
- Write "dollars" instead of using $ symbol
- No abbreviations or shortened forms
- Professional but energetic tone
- Strong hook and call-to-action

Make it compelling for buyers and investors with perfect grammar throughout.`,
        },
      ],
      max_tokens: 600,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const rawScript = data.choices[0].message.content.trim()

  // Apply comprehensive sanitization and grammar fixes
  const sanitizedScript = sanitizeAndFixGrammar(rawScript)

  console.log("🧹 Script sanitized and grammar-checked")
  return sanitizedScript
}

// Enhanced sanitization with grammar fixes
function sanitizeAndFixGrammar(text: string): string {
  console.log("🧹 Applying grammar fixes and sanitization...")

  let cleaned = sanitizeScript(text)

  // Fix common abbreviations that might slip through
  cleaned = cleaned
    .replace(/\bBR\b/g, "bedrooms")
    .replace(/\bBA\b/g, "bathrooms")
    .replace(/\bsqft\b/gi, "square feet")
    .replace(/\bsq ft\b/gi, "square feet")
    .replace(/\bsq\. ft\./gi, "square feet")
    .replace(/\bK\b/g, "thousand")
    .replace(/\$(\d+)K/g, "$1 thousand dollars")
    .replace(/\$(\d+)M/g, "$1 million dollars")

  // Fix contractions for more formal speech
  cleaned = cleaned
    .replace(/don't/gi, "do not")
    .replace(/won't/gi, "will not")
    .replace(/can't/gi, "cannot")
    .replace(/isn't/gi, "is not")
    .replace(/aren't/gi, "are not")
    .replace(/wasn't/gi, "was not")
    .replace(/weren't/gi, "were not")
    .replace(/hasn't/gi, "has not")
    .replace(/haven't/gi, "have not")
    .replace(/hadn't/gi, "had not")
    .replace(/doesn't/gi, "does not")
    .replace(/didn't/gi, "did not")
    .replace(/shouldn't/gi, "should not")
    .replace(/wouldn't/gi, "would not")
    .replace(/couldn't/gi, "could not")
    .replace(/you're/gi, "you are")
    .replace(/we're/gi, "we are")
    .replace(/they're/gi, "they are")
    .replace(/it's/gi, "it is")
    .replace(/that's/gi, "that is")
    .replace(/here's/gi, "here is")
    .replace(/there's/gi, "there is")
    .replace(/what's/gi, "what is")
    .replace(/let's/gi, "let us")

  // Fix number formatting (write out numbers under 10)
  cleaned = cleaned
    .replace(/\b1\b/g, "one")
    .replace(/\b2\b/g, "two")
    .replace(/\b3\b/g, "three")
    .replace(/\b4\b/g, "four")
    .replace(/\b5\b/g, "five")
    .replace(/\b6\b/g, "six")
    .replace(/\b7\b/g, "seven")
    .replace(/\b8\b/g, "eight")
    .replace(/\b9\b/g, "nine")

  // Ensure proper sentence structure
  cleaned = cleaned
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/\s*([.!?])\s*/g, "$1 ") // Fix punctuation spacing
    .replace(/([.!?])\s*([a-z])/g, "$1 $2") // Ensure space after sentence endings
    .replace(/([.!?])([A-Z])/g, "$1 $2") // Space between sentences

  // Capitalize first letter of sentences
  cleaned = cleaned.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase())

  // Final cleanup
  cleaned = cleaned.trim()

  console.log("✅ Grammar fixes and sanitization complete")
  return cleaned
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
    const basicScript = sanitizeScript(
      `Welcome to this amazing property! This stunning home features multiple bedrooms and bathrooms with incredible living space. Don't miss this opportunity! Contact me today!`,
    )

    return NextResponse.json({
      success: true,
      script: basicScript,
      method: "basic (emoji-free)",
    })
  }
}
