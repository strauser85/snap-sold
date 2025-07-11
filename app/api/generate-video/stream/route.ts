import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const { mlsId, listing } = await request.json()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = (step: string, progress: number) => {
        const data = JSON.stringify({ step, progress })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      const steps = [
        { step: `Fetching MLS data for ${mlsId}...`, progress: 20 },
        { step: `Property: ${listing?.address || "Unknown address"}`, progress: 30 },
        { step: "Generating script from listing data...", progress: 50 },
        { step: "Creating AI voiceover...", progress: 70 },
        { step: "Generating final video...", progress: 90 },
        { step: "Finalizing and saving...", progress: 100 },
      ]

      let currentStep = 0
      const interval = setInterval(() => {
        if (currentStep < steps.length) {
          sendUpdate(steps[currentStep].step, steps[currentStep].progress)
          currentStep++
        } else {
          controller.close()
          clearInterval(interval)
        }
      }, 1000) // 1 second per step for smoother UI
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
