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

// AGGRESSIVE abbreviation removal and grammar fixing
function aggressivelyFixAbbreviations(text: string): string {
  console.log("🔧 AGGRESSIVELY fixing abbreviations and grammar...")
  console.log("📝 Before fixes:", text.substring(0, 150))

  let fixed = text

  // Fix bedroom abbreviations (all variations)
  fixed = fixed
    .replace(/(\d+)\s*BR\b/gi, "$1 bedrooms")
    .replace(/(\d+)\s*BED\b/gi, "$1 bedrooms")
    .replace(/(\d+)\s*BDRM\b/gi, "$1 bedrooms")
    .replace(/(\d+)\s*bedroom\b/gi, "$1 bedrooms") // Make plural
    .replace(/one\s+bedrooms\b/gi, "one bedroom") // Fix singular
    .replace(/1\s+bedrooms\b/gi, "one bedroom")

  // Fix bathroom abbreviations (all variations)
  fixed = fixed
    .replace(/(\d+(?:\.\d+)?)\s*BA\b/gi, "$1 bathrooms")
    .replace(/(\d+(?:\.\d+)?)\s*BATH\b/gi, "$1 bathrooms")
    .replace(/(\d+(?:\.\d+)?)\s*BTH\b/gi, "$1 bathrooms")
    .replace(/(\d+(?:\.\d+)?)\s*bathroom\b/gi, "$1 bathrooms") // Make plural
    .replace(/one\s+bathrooms\b/gi, "one bathroom") // Fix singular
    .replace(/1\s+bathrooms\b/gi, "one bathroom")
    .replace(/1\.0\s+bathrooms\b/gi, "one bathroom")

  // Fix square feet abbreviations (all variations)
  fixed = fixed
    .replace(/(\d+(?:,\d+)*)\s*SQFT\b/gi, "$1 square feet")
    .replace(/(\d+(?:,\d+)*)\s*SQ\s*FT\b/gi, "$1 square feet")
    .replace(/(\d+(?:,\d+)*)\s*SF\b/gi, "$1 square feet")
    .replace(/(\d+(?:,\d+)*)\s*sq\.\s*ft\./gi, "$1 square feet")

  // Fix price abbreviations
  fixed = fixed
    .replace(/\$(\d+(?:,\d+)*)\s*K\b/gi, "$1 thousand dollars")
    .replace(/\$(\d+(?:,\d+)*)\s*M\b/gi, "$1 million dollars")
    .replace(/(\d+)\s*K\b/gi, "$1 thousand")
    .replace(/(\d+)\s*M\b/gi, "$1 million")

  // Fix other common real estate abbreviations
  fixed = fixed
    .replace(/\bHOA\b/gi, "homeowners association")
    .replace(/\bA\/C\b/gi, "air conditioning")
    .replace(/\bHVAC\b/gi, "heating and air conditioning")
    .replace(/\bW\/D\b/gi, "washer and dryer")
    .replace(/\bSS\b/gi, "stainless steel")
    .replace(/\bGR\b/gi, "great room")
    .replace(/\bMBR\b/gi, "master bedroom")
    .replace(/\bFP\b/gi, "fireplace")
    .replace(/\bLG\b/gi, "large")
    .replace(/\bSM\b/gi, "small")
    .replace(/\bMED\b/gi, "medium")
    .replace(/\bXL\b/gi, "extra large")
    .replace(/\bLRG\b/gi, "large")
    .replace(/\bAPPROX\b/gi, "approximately")
    .replace(/\bAPPX\b/gi, "approximately")
    .replace(/\bW\/\b/gi, "with ")
    .replace(/\bWO\b/gi, "without")
    .replace(/\bUPD\b/gi, "updated")
    .replace(/\bREN\b/gi, "renovated")
    .replace(/\bNEW\b/gi, "new")
    .replace(/\bORIG\b/gi, "original")
    .replace(/\bHW\b/gi, "hardwood")
    .replace(/\bTILE\b/gi, "tile")
    .replace(/\bCPT\b/gi, "carpet")
    .replace(/\bKIT\b/gi, "kitchen")
    .replace(/\bLR\b/gi, "living room")
    .replace(/\bDR\b/gi, "dining room")
    .replace(/\bFR\b/gi, "family room")
    .replace(/\bBSMT\b/gi, "basement")
    .replace(/\bGAR\b/gi, "garage")
    .replace(/\bDECK\b/gi, "deck")
    .replace(/\bPATIO\b/gi, "patio")
    .replace(/\bYRD\b/gi, "yard")
    .replace(/\bFENC\b/gi, "fenced")
    .replace(/\bLNDSCP\b/gi, "landscaped")
    .replace(/\bPVT\b/gi, "private")
    .replace(/\bQUIET\b/gi, "quiet")
    .replace(/\bCUL\b/gi, "cul-de-sac")
    .replace(/\bSTR\b/gi, "street")
    .replace(/\bAVE\b/gi, "avenue")
    .replace(/\bBLVD\b/gi, "boulevard")
    .replace(/\bRD\b/gi, "road")
    .replace(/\bDR\b/gi, "drive")
    .replace(/\bCT\b/gi, "court")
    .replace(/\bLN\b/gi, "lane")
    .replace(/\bPL\b/gi, "place")
    .replace(/\bCIR\b/gi, "circle")

  // Fix contractions to be more formal
  fixed = fixed
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
    .replace(/I'm/gi, "I am")
    .replace(/you'll/gi, "you will")
    .replace(/we'll/gi, "we will")
    .replace(/they'll/gi, "they will")

  // Convert numbers under 10 to words (but preserve larger numbers)
  fixed = fixed
    .replace(/\b1\s+(?=bedrooms?|bathrooms?)/gi, "one ")
    .replace(/\b2\s+(?=bedrooms?|bathrooms?)/gi, "two ")
    .replace(/\b3\s+(?=bedrooms?|bathrooms?)/gi, "three ")
    .replace(/\b4\s+(?=bedrooms?|bathrooms?)/gi, "four ")
    .replace(/\b5\s+(?=bedrooms?|bathrooms?)/gi, "five ")
    .replace(/\b6\s+(?=bedrooms?|bathrooms?)/gi, "six ")
    .replace(/\b7\s+(?=bedrooms?|bathrooms?)/gi, "seven ")
    .replace(/\b8\s+(?=bedrooms?|bathrooms?)/gi, "eight ")
    .replace(/\b9\s+(?=bedrooms?|bathrooms?)/gi, "nine ")

  // Fix decimal bathrooms
  fixed = fixed
    .replace(/2\.5\s+bathrooms/gi, "two and a half bathrooms")
    .replace(/1\.5\s+bathrooms/gi, "one and a half bathrooms")
    .replace(/3\.5\s+bathrooms/gi, "three and a half bathrooms")
    .replace(/4\.5\s+bathrooms/gi, "four and a half bathrooms")

  // Fix grammar issues
  fixed = fixed
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/\s*([.!?])\s*/g, "$1 ") // Fix punctuation spacing
    .replace(/([.!?])\s*([a-z])/g, "$1 $2") // Ensure space after sentence endings
    .replace(/([.!?])([A-Z])/g, "$1 $2") // Space between sentences

  // Capitalize first letter of sentences
  fixed = fixed.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase())

  // Final cleanup
  fixed = fixed.trim()

  console.log("✅ AGGRESSIVE fixes complete")
  console.log("📝 After fixes:", fixed.substring(0, 150))

  return fixed
}

// Fallback script templates with perfect grammar and no abbreviations
const generateFallbackScript = (data: PropertyData): string => {
  const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount = 1 } = data

  const priceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price)

  // Convert numbers to words for bedrooms/bathrooms
  const bedroomText = bedrooms === 1 ? "one bedroom" : `${bedrooms} bedrooms`
  const bathroomText =
    bathrooms === 1
      ? "one bathroom"
      : bathrooms === 1.5
        ? "one and a half bathrooms"
        : bathrooms === 2.5
          ? "two and a half bathrooms"
          : bathrooms === 3.5
            ? "three and a half bathrooms"
            : `${bathrooms} bathrooms`

  const hooks = [
    "Stop scrolling! This property is about to blow your mind!",
    "You need to see this house! This is why I love real estate!",
    "Want to see a million dollar opportunity? Look at this!",
    "This house is absolutely stunning! Here is why you need to see it.",
    "Attention home buyers! This property will not last long!",
  ]

  const midSections = [
    `We have ${bedroomText} and ${bathroomText} spread across ${sqft.toLocaleString()} square feet of pure luxury!`,
    `${bedroomText}, ${bathroomText}, and ${sqft.toLocaleString()} square feet of absolute perfection!`,
    `This ${bedroomText}, ${bathroomText} masterpiece offers ${sqft.toLocaleString()} square feet of dream living!`,
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

  // Apply aggressive fixes to fallback script too
  return aggressivelyFixAbbreviations(sanitizeScript(script))
}

// OpenAI API function with MUCH stronger prompt
async function generateOpenAIScript(propertyData: PropertyData): Promise<string> {
  const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount = 1 } = propertyData

  // Convert numbers to words for the prompt
  const bedroomText = bedrooms === 1 ? "one bedroom" : `${bedrooms} bedrooms`
  const bathroomText =
    bathrooms === 1
      ? "one bathroom"
      : bathrooms === 1.5
        ? "one and a half bathrooms"
        : bathrooms === 2.5
          ? "two and a half bathrooms"
          : bathrooms === 3.5
            ? "three and a half bathrooms"
            : `${bathrooms} bathrooms`

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
          content: `You are a professional real estate marketing expert. Create TikTok scripts with PERFECT grammar and ZERO abbreviations.

CRITICAL RULES - NEVER BREAK THESE:
1. NEVER use BR, BA, SQFT, SF, SQ FT, or any abbreviations
2. ALWAYS write "bedrooms" and "bathrooms" in full
3. ALWAYS write "square feet" never "sqft" or "sq ft"
4. NEVER use contractions (don't → do not, you're → you are)
5. Write numbers under 10 as words (3 → three, 4 → four)
6. Use perfect grammar and complete sentences
7. No emojis, symbols, or special characters

EXAMPLES OF WHAT TO WRITE:
✅ "This four bedroom, two and a half bathroom home"
✅ "two thousand five hundred square feet"
✅ "You will not believe this opportunity"

EXAMPLES OF WHAT NEVER TO WRITE:
❌ "This 4BR, 2.5BA home"
❌ "2500 sqft" or "2500 sq ft"
❌ "You won't believe this"

Create an engaging TikTok script following these rules exactly.`,
        },
        {
          role: "user",
          content: `Create a TikTok script with ZERO abbreviations for this property:

Address: ${address}
Bedrooms: ${bedroomText}
Bathrooms: ${bathroomText}
Square Feet: ${sqft.toLocaleString()} square feet
Price: ${price.toLocaleString()} dollars
Images: ${imageCount} photos

${propertyDescription && propertyDescription.trim() ? `Special Features: ${propertyDescription.trim()}` : ""}

REMEMBER:
- Write "${bedroomText}" not "${bedrooms}BR"
- Write "${bathroomText}" not "${bathrooms}BA"
- Write "${sqft.toLocaleString()} square feet" not "${sqft} sqft"
- Use complete words and perfect grammar
- No abbreviations whatsoever

Create an engaging 45-60 second script with perfect grammar and zero abbreviations.`,
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

  // Apply AGGRESSIVE abbreviation fixing
  const fixedScript = aggressivelyFixAbbreviations(sanitizeScript(rawScript))

  console.log("🧹 Script aggressively fixed for abbreviations")
  console.log("📝 Final script sample:", fixedScript.substring(0, 150))

  return fixedScript
}

export async function POST(request: NextRequest) {
  try {
    const propertyData: PropertyData = await request.json()

    console.log("Generating NO-ABBREVIATION script for:", propertyData.address)
    if (propertyData.propertyDescription) {
      console.log("Including custom property description:", propertyData.propertyDescription.substring(0, 100) + "...")
    }

    // First try OpenAI API if key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log("Using OpenAI API for NO-ABBREVIATION script generation...")
        const script = await generateOpenAIScript(propertyData)

        console.log("OpenAI NO-ABBREVIATION script generated successfully")
        console.log("Sample output:", script.substring(0, 100) + "...")

        return NextResponse.json({
          success: true,
          script: script,
          method: "OpenAI (no-abbreviations)",
        })
      } catch (aiError) {
        console.log("OpenAI API failed, using fallback:", aiError)
      }
    } else {
      console.log("No OpenAI API key found, using fallback")
    }

    // Use fallback script generation
    const fallbackScript = generateFallbackScript(propertyData)

    console.log("Fallback NO-ABBREVIATION script generated successfully")
    console.log("Sample output:", fallbackScript.substring(0, 100) + "...")

    return NextResponse.json({
      success: true,
      script: fallbackScript,
      method: "fallback (no-abbreviations)",
    })
  } catch (error) {
    console.error("Script generation error:", error)

    // Last resort - basic template
    const basicScript = aggressivelyFixAbbreviations(
      sanitizeScript(
        `Welcome to this amazing property! This stunning home features multiple bedrooms and bathrooms with incredible living space. Do not miss this opportunity! Contact me today!`,
      ),
    )

    return NextResponse.json({
      success: true,
      script: basicScript,
      method: "basic (no-abbreviations)",
    })
  }
}
