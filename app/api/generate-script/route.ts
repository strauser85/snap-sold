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

// CONTEXT-AWARE abbreviation fixing
function contextAwareAbbreviationFix(text: string, address: string): string {
  console.log("🔧 CONTEXT-AWARE abbreviation fixing...")
  console.log("📝 Address context:", address)
  console.log("📝 Before fixes:", text.substring(0, 150))

  let fixed = text

  // CONTEXT-AWARE ADDRESS ABBREVIATIONS
  // Fix street type abbreviations in addresses (case-insensitive)
  fixed = fixed
    .replace(/\bSt\.?\b/gi, "Street")
    .replace(/\bAve\.?\b/gi, "Avenue")
    .replace(/\bBlvd\.?\b/gi, "Boulevard")
    .replace(/\bRd\.?\b/gi, "Road")
    .replace(/\bLn\.?\b/gi, "Lane")
    .replace(/\bCt\.?\b/gi, "Court")
    .replace(/\bPl\.?\b/gi, "Place")
    .replace(/\bCir\.?\b/gi, "Circle")
    .replace(/\bPkwy\.?\b/gi, "Parkway")
    .replace(/\bTer\.?\b/gi, "Terrace")
    .replace(/\bWay\.?\b/gi, "Way")

  // CONTEXT-AWARE DR HANDLING
  // If "Dr" appears in the address context, it's likely "Drive"
  const addressLower = address.toLowerCase()
  if (addressLower.includes(" dr ") || addressLower.endsWith(" dr") || addressLower.includes(" dr.")) {
    // Replace Dr/DR when it appears to be part of an address
    fixed = fixed.replace(/\b(\d+\s+[A-Za-z\s]+)\s+Dr\.?\b/gi, "$1 Drive")
    fixed = fixed.replace(/\bDr\.?\s+(in|on|at)\b/gi, "Drive $1")
  }

  // PROPERTY DESCRIPTION ABBREVIATIONS (after address handling)
  // Now handle room abbreviations - DR in property context means Dining Room
  fixed = fixed
    .replace(/\bDR\b/g, "dining room") // Dining Room
    .replace(/\bLR\b/g, "living room") // Living Room
    .replace(/\bFR\b/g, "family room") // Family Room
    .replace(/\bMBR\b/g, "master bedroom") // Master Bedroom
    .replace(/\bBR\b/g, "bedroom") // Bedroom (when not preceded by number)
    .replace(/\bBA\b/g, "bathroom") // Bathroom (when not preceded by number)

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

  // Fix decimal bathrooms - IMPROVED NATURAL SPEECH
  fixed = fixed
    .replace(/(\d+)\.(\d+)\s+bathrooms/gi, (match, whole, decimal) => {
      if (decimal === "5") return `${whole} and a half bathrooms`
      return match // Keep other decimals as-is for now
    })
    .replace(/(\d+)\.(\d+)\s+bathroom/gi, (match, whole, decimal) => {
      if (decimal === "5") return `${whole} and a half bathrooms`
      return match
    })
    // Handle the specific "1. Five" error pattern
    .replace(/1\.\s*Five\s+bathrooms/gi, "one and a half bathrooms")
    .replace(/2\.\s*Five\s+bathrooms/gi, "two and a half bathrooms")
    .replace(/3\.\s*Five\s+bathrooms/gi, "three and a half bathrooms")

  // Fix quote marks and punctuation
  fixed = fixed
    .replace(/Don"t/gi, "Do not")
    .replace(/can"t/gi, "cannot")
    .replace(/won"t/gi, "will not")
    .replace(/isn"t/gi, "is not")
    .replace(/aren"t/gi, "are not")
    .replace(/doesn"t/gi, "does not")
    .replace(/didn"t/gi, "did not")
    .replace(/shouldn"t/gi, "should not")
    .replace(/wouldn"t/gi, "would not")
    .replace(/couldn"t/gi, "could not")
    .replace(/"/g, "") // Remove any remaining quote marks

  // Fix grammar issues
  fixed = fixed
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/\s*([.!?])\s*/g, "$1 ") // Fix punctuation spacing
    .replace(/([.!?])\s*([a-z])/g, "$1 $2") // Ensure space after sentence endings
    .replace(/([.!?])([A-Z])/g, "$1 $2") // Space between sentences

  // Capitalize first letter of sentences
  fixed = fixed.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase())

  // Final cleanup for common errors
  fixed = fixed
    .replace(/\s+/g, " ") // Normalize all whitespace
    .replace(/\.\s*([a-z])/g, ". $1") // Fix spacing after periods
    .replace(/([.!?])\s*([A-Z])/g, "$1 $2") // Ensure proper sentence spacing
    .trim()

  // Final cleanup
  fixed = fixed.trim()

  console.log("✅ CONTEXT-AWARE fixes complete")
  console.log("📝 After fixes:", fixed.substring(0, 150))

  return fixed
}

// DYNAMIC SCRIPT VARIATIONS - Multiple templates for variety
const SCRIPT_VARIATIONS = {
  intros: [
    "Stop scrolling! This property is about to blow your mind!",
    "You need to see this house! This is why I love real estate!",
    "Want to see a million dollar opportunity? Look at this!",
    "This house is absolutely stunning! Here is why you need to see it.",
    "Attention home buyers! This property will not last long!",
    "Hold up! Before you scroll past this, you have got to see these details!",
    "Real estate friends, this one is special! Let me show you why!",
    "I have been in real estate for years, and this property still amazes me!",
    "Okay everyone, gather around because this house is incredible!",
    "Listen up! I am about to show you something that will change your mind about home buying!",
    "Wait, wait, wait! Do not scroll past this without seeing these details!",
    "Home buyers, this is exactly what you have been looking for!",
    "I cannot believe this property is still available! Here is why it is perfect!",
    "This is hands down one of the most beautiful homes I have ever seen!",
    "If you are house hunting, you absolutely need to see this property!",
  ],

  propertyIntros: [
    "Welcome to {address}!",
    "Let me introduce you to {address}!",
    "Take a look at this stunning property at {address}!",
    "Here we have an incredible home located at {address}!",
    "Check out this amazing property on {address}!",
    "I am excited to show you {address}!",
    "This beautiful home at {address} is something special!",
    "Located at {address}, this property offers everything you need!",
    "Step inside this gorgeous home at {address}!",
    "You are going to love what {address} has to offer!",
  ],

  featureDescriptions: [
    "We have {bedrooms} and {bathrooms} spread across {sqft} square feet of pure luxury!",
    "{bedrooms}, {bathrooms}, and {sqft} square feet of absolute perfection!",
    "This {bedrooms}, {bathrooms} masterpiece offers {sqft} square feet of dream living!",
    "With {bedrooms} and {bathrooms}, this {sqft} square foot home is simply incredible!",
    "Picture this: {bedrooms}, {bathrooms}, and {sqft} square feet of beautiful living space!",
    "You get {bedrooms} and {bathrooms} in this spacious {sqft} square foot layout!",
    "This home features {bedrooms} and {bathrooms} with {sqft} square feet of comfort!",
    "Imagine living in {bedrooms} and {bathrooms} across {sqft} square feet of elegance!",
    "The floor plan includes {bedrooms} and {bathrooms} throughout {sqft} square feet!",
    "This property boasts {bedrooms} and {bathrooms} in {sqft} square feet of luxury living!",
  ],

  transitionPhrases: [
    "But wait, there is more!",
    "And here is the best part!",
    "Now let me tell you about the special features!",
    "You are going to love this next part!",
    "Hold on, because it gets even better!",
    "The amazing features do not stop there!",
    "Let me share what makes this property unique!",
    "Here is what really sets this home apart!",
    "And the incredible details continue!",
    "But the best features are yet to come!",
  ],

  priceIntros: [
    "Priced at {price}, this property is an incredible opportunity!",
    "At {price}, this home offers exceptional value!",
    "For just {price}, you can own this amazing property!",
    "This stunning home is priced at {price} and worth every penny!",
    "At {price}, this is the deal you have been waiting for!",
    "Listed at {price}, this property will not last long!",
    "With a price of {price}, this home is a fantastic investment!",
    "At {price}, you are getting luxury at an unbeatable value!",
    "This incredible property is available for {price}!",
    "Priced to sell at {price}, this home is move-in ready!",
  ],

  callToActions: [
    "Do not let this opportunity slip away! Direct message me now!",
    "This will not last long at this price! Contact me today!",
    "Ready to make this your home? Let us talk!",
    "Investment opportunity of a lifetime! Call me!",
    "Serious buyers only! Send me a message right now!",
    "Do not wait! This property will be gone by tomorrow! Call me!",
    "If you are interested, you need to act fast! Direct message me!",
    "This is your chance to own something special! Contact me immediately!",
    "Stop looking and start living! Message me for a showing!",
    "Your dream home is waiting! Reach out to me today!",
    "Time is running out! Contact me before someone else does!",
    "This could be yours! Send me a direct message now!",
    "Do not miss out on this incredible opportunity! Call me today!",
    "Ready to see it in person? Message me to schedule a tour!",
    "This property has everything you want! Contact me right away!",
  ],

  pacingVariations: [
    "short", // Quick, punchy sentences
    "medium", // Balanced mix
    "flowing", // Longer, more descriptive sentences
  ],
}

// Generate dynamic script with personality variations
const generateDynamicScript = (data: PropertyData): string => {
  const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount = 1 } = data

  // Create a seed based on address for consistent but varied selection
  const addressSeed = address.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const random = (max: number) => Math.floor((((addressSeed * 9301 + 49297) % 233280) / 233280) * max)

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
            : bathrooms === 4.5
              ? "four and a half bathrooms"
              : bathrooms === 5.5
                ? "five and a half bathrooms"
                : `${bathrooms} bathrooms`

  // Select variations based on address seed for consistency
  const intro = SCRIPT_VARIATIONS.intros[random(SCRIPT_VARIATIONS.intros.length)]
  const propertyIntro = SCRIPT_VARIATIONS.propertyIntros[random(SCRIPT_VARIATIONS.propertyIntros.length)].replace(
    "{address}",
    address,
  )
  const featureDesc = SCRIPT_VARIATIONS.featureDescriptions[random(SCRIPT_VARIATIONS.featureDescriptions.length)]
    .replace("{bedrooms}", bedroomText)
    .replace("{bathrooms}", bathroomText)
    .replace("{sqft}", sqft.toLocaleString())
  const transition = SCRIPT_VARIATIONS.transitionPhrases[random(SCRIPT_VARIATIONS.transitionPhrases.length)]
  const priceIntro = SCRIPT_VARIATIONS.priceIntros[random(SCRIPT_VARIATIONS.priceIntros.length)].replace(
    "{price}",
    priceFormatted,
  )
  const callToAction = SCRIPT_VARIATIONS.callToActions[random(SCRIPT_VARIATIONS.callToActions.length)]
  const pacing = SCRIPT_VARIATIONS.pacingVariations[random(SCRIPT_VARIATIONS.pacingVariations.length)]

  // Build script with selected pacing style
  let script = ""

  if (pacing === "short") {
    // Short, punchy style
    script += `${intro}\n\n`
    script += `${propertyIntro} ${featureDesc}\n\n`

    if (propertyDescription && propertyDescription.trim()) {
      script += `${transition} ${propertyDescription.trim()}\n\n`
    }

    script += `${priceIntro} `

    if (imageCount > 5) {
      script += `Plus, ${imageCount} stunning photos show every detail! `
    }

    script += `${callToAction}`
  } else if (pacing === "flowing") {
    // Longer, more descriptive style
    script += `${intro} `
    script += `${propertyIntro} This incredible home features ${featureDesc.toLowerCase()}\n\n`

    if (propertyDescription && propertyDescription.trim()) {
      script += `${transition} ${propertyDescription.trim()} These thoughtful details make this property truly exceptional.\n\n`
    }

    script += `${priceIntro} `

    if (imageCount > 5) {
      script += `With ${imageCount} beautiful photos available, you can explore every corner of this amazing home before you visit. `
    }

    script += `${callToAction}`
  } else {
    // Medium, balanced style (default)
    script += `${intro}\n\n`
    script += `${propertyIntro} ${featureDesc}\n\n`

    if (propertyDescription && propertyDescription.trim()) {
      script += `${transition} ${propertyDescription.trim()}\n\n`
    }

    script += `${priceIntro} `

    if (imageCount > 5) {
      script += `And with ${imageCount} stunning photos, you can see every amazing detail! `
    }

    script += `${callToAction}`
  }

  console.log(`🎭 Generated ${pacing} paced script with dynamic variations`)
  console.log(`🎯 Intro: ${intro.substring(0, 30)}...`)
  console.log(`🏠 Property: ${propertyIntro.substring(0, 30)}...`)
  console.log(`📞 CTA: ${callToAction.substring(0, 30)}...`)

  // Apply context-aware fixes to dynamic script
  return contextAwareAbbreviationFix(sanitizeScript(script), address)
}

// OpenAI API function with DYNAMIC VARIATION prompts
async function generateOpenAIScript(propertyData: PropertyData): Promise<string> {
  const { address, price, bedrooms, bathrooms, sqft, propertyDescription, imageCount = 1 } = propertyData

  // Create variation seed for consistent but different results
  const addressSeed = address.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const variationStyles = [
    "energetic and enthusiastic",
    "professional and informative",
    "conversational and friendly",
    "confident and persuasive",
    "warm and inviting",
  ]
  const selectedStyle = variationStyles[addressSeed % variationStyles.length]

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
          content: `You are a professional real estate marketing expert who creates VARIED and DYNAMIC TikTok scripts. Each script should feel unique and human-like with personality.

CRITICAL RULES - NEVER BREAK THESE:
1. NEVER use BR, BA, SQFT, SF, SQ FT, or any abbreviations
2. ALWAYS write "bedrooms" and "bathrooms" in full
3. ALWAYS write "square feet" never "sqft" or "sq ft"
4. NEVER use contractions (don't → do not, you're → you are)
5. Write numbers under 10 as words (3 → three, 4 → four)
6. Use perfect grammar and complete sentences
7. No emojis, symbols, or special characters
8. CONTEXT MATTERS: "Dr" in addresses means "Drive", "DR" in room descriptions means "Dining Room"

DYNAMIC VARIATION REQUIREMENTS:
- Use different sentence structures and pacing
- Vary your intro hooks (attention-grabbing vs informational vs conversational)
- Rotate between different call-to-action styles
- Add personality and natural speech patterns
- Use different transition phrases
- Vary how you present the same information

STYLE FOR THIS SCRIPT: ${selectedStyle}

Create a script that sounds natural and human, not robotic or templated.`,
        },
        {
          role: "user",
          content: `Create a DYNAMIC and VARIED TikTok script with ZERO abbreviations for this property. Make it sound ${selectedStyle}:

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
- Context matters: Dr in address = Drive, DR in rooms = Dining Room
- Make it sound ${selectedStyle} and unique
- Vary sentence structure and pacing
- Use natural, human-like language

Create an engaging 45-60 second script that feels personal and dynamic.`,
        },
      ],
      max_tokens: 600,
      temperature: 0.8, // Higher temperature for more variation
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const dataResponse = await response.json()
  const rawScript = dataResponse.choices[0].message.content.trim()

  // Apply CONTEXT-AWARE abbreviation fixing
  const fixedScript = contextAwareAbbreviationFix(sanitizeScript(rawScript), address)

  console.log(`🎭 OpenAI generated ${selectedStyle} script with dynamic variation`)
  console.log("📝 Final script sample:", fixedScript.substring(0, 150))

  return fixedScript
}

export async function POST(request: NextRequest) {
  try {
    const propertyData: PropertyData = await request.json()

    console.log("🎭 Generating DYNAMIC VARIED script for:", propertyData.address)
    if (propertyData.propertyDescription) {
      console.log("Including custom property description:", propertyData.propertyDescription.substring(0, 100) + "...")
    }

    // First try OpenAI API if key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log("🎭 Using OpenAI API for DYNAMIC VARIED script generation...")
        const script = await generateOpenAIScript(propertyData)

        console.log("✅ OpenAI DYNAMIC VARIED script generated successfully")
        console.log("Sample output:", script.substring(0, 100) + "...")

        return NextResponse.json({
          success: true,
          script: script,
          method: "OpenAI (dynamic-varied)",
        })
      } catch (aiError) {
        console.log("OpenAI API failed, using dynamic fallback:", aiError)
      }
    } else {
      console.log("No OpenAI API key found, using dynamic fallback")
    }

    // Use dynamic fallback script generation
    const dynamicScript = generateDynamicScript(propertyData)

    console.log("✅ Dynamic fallback script generated successfully")
    console.log("Sample output:", dynamicScript.substring(0, 100) + "...")

    return NextResponse.json({
      success: true,
      script: dynamicScript,
      method: "fallback (dynamic-varied)",
    })
  } catch (error) {
    console.error("Script generation error:", error)

    // Last resort - basic template with some variation
    const basicVariations = [
      "Welcome to this amazing property! This stunning home features multiple bedrooms and bathrooms with incredible living space. Do not miss this opportunity! Contact me today!",
      "Check out this incredible home! With spacious bedrooms and bathrooms, this property offers everything you need. This is a fantastic opportunity! Reach out to me now!",
      "You have got to see this beautiful property! This home has wonderful bedrooms and bathrooms with plenty of living space. Do not wait! Message me today!",
    ]

    const addressSeed = propertyData.address.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const selectedBasic = basicVariations[addressSeed % basicVariations.length]

    const basicScript = contextAwareAbbreviationFix(sanitizeScript(selectedBasic), propertyData.address)

    return NextResponse.json({
      success: true,
      script: basicScript,
      method: "basic (dynamic-varied)",
    })
  }
}
