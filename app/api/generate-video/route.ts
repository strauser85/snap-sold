import { type NextRequest, NextResponse } from "next/server";

// Make sure to import Buffer explicitly for Node environments
import { Buffer } from "buffer";

// Next.js App Router: allow larger body size
export const maxBodySize = "100mb";

interface PropertyInput {
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  propertyDescription?: string;
  script: string;
  imageUrls: string[];
}

// Generate ElevenLabs voiceover
async function generateElevenLabsVoiceover(
  script: string
): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
  try {
    console.log("🎤 Starting ElevenLabs generation...");

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("❌ ELEVENLABS_API_KEY not found");
      return {
        success: false,
        error: "Missing ElevenLabs API key.",
      };
    }

    const cleanedScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\$(\d+)/g, "$1 dollars")
      .replace(/(\d+)\s*sq\s*ft/gi, "$1 square feet")
      .replace(/(\d+)\s*bed/gi, "$1 bedroom")
      .replace(/(\d+)\s*bath/gi, "$1 bathroom")
      .replace(/(\d{5})/g, (_, zip) => zip.split("").join(" "))
      .replace(/(\d+)\.(\d+)/g, (_, intPart, decimalPart) => `${intPart} point ${decimalPart}`);

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/Rachel", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: cleanedScript,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
      }),
    });

    if (!response.ok) {
      const errMsg = await response.text();
      console.error("❌ ElevenLabs API error:", errMsg);
      return {
        success: false,
        error: `ElevenLabs API error: ${errMsg}`,
      };
    }

    const buffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(buffer).toString("base64");
    const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

    return { success: true, audioUrl };
  } catch (err) {
    console.error("🎤 Voice generation failed:", err);
    return {
      success: false,
      error: "Unexpected error during voiceover generation.",
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const data: PropertyInput = await req.json();

    if (!data.script) {
      return NextResponse.json({ error: "No script provided." }, { status: 400 });
    }

    const result = await generateElevenLabsVoiceover(data.script);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ audioUrl: result.audioUrl });
  } catch (err) {
    console.error("🔥 Route handler error:", err);
    return NextResponse.json({ error: "Invalid request or unexpected failure." }, { status: 500 });
  }
}