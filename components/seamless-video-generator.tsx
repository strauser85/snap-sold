"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Progress } from "@/components/ui/progress"

interface PropertyData {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription: string
  script: string
  imageUrls: string[]
}

interface SeamlessVideoGeneratorProps {
  propertyData: PropertyData
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

interface WordTiming {
  word: string
  startTime: number
  endTime: number
}

interface CaptionChunk {
  text: string
  words: WordTiming[]
  startTime: number
  endTime: number
}

interface HighlightCaption {
  text: string
  startTime: number
  endTime: number
  priority: number
}

interface ImageDisplayPlan {
  imageUrl: string
  startTime: number
  endTime: number
  duration: number
  isReused: boolean
  priority: number
}

interface CaptionRenderInfo {
  fontSize: number
  lines: string[]
  x: number
  y: number
  autoScaled: boolean
  maxWidth: number
}

export function SeamlessVideoGenerator({ propertyData, onVideoGenerated, onError }: SeamlessVideoGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const animationRef = useRef<number | null>(null)

  const [progress, setProgress] = useState(0)

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }, [])

  // SMART IMAGE PRIORITIZATION AND TIMING
  const createImageDisplayPlan = useCallback((imageUrls: string[], totalDuration: number): ImageDisplayPlan[] => {
    const imageCount = imageUrls.length
    console.log(`📸 Planning display for ${imageCount} images over ${totalDuration.toFixed(1)}s`)

    const displayPlan: ImageDisplayPlan[] = []

    if (imageCount < 10) {
      // UNDER 10 PHOTOS: Extend display time and reuse key images
      console.log(`📸 Under 10 photos detected - extending display time and reusing key images`)

      const baseTimePerImage = totalDuration / Math.max(imageCount, 8) // Minimum 8 image slots

      // Identify key images (assume first few are most important)
      const keyImageIndices = [0, 1, 2] // Front, kitchen, living room typically

      let currentTime = 0
      let imageIndex = 0

      while (currentTime < totalDuration) {
        const remainingTime = totalDuration - currentTime
        const remainingSlots = Math.ceil(remainingTime / baseTimePerImage)
        const timeForThisImage = Math.min(baseTimePerImage, remainingTime)

        const actualImageIndex = imageIndex % imageCount
        const isReused = imageIndex >= imageCount

        displayPlan.push({
          imageUrl: imageUrls[actualImageIndex],
          startTime: currentTime,
          endTime: currentTime + timeForThisImage,
          duration: timeForThisImage,
          isReused,
          priority: keyImageIndices.includes(actualImageIndex) ? 5 : 3,
        })

        currentTime += timeForThisImage
        imageIndex++

        if (currentTime >= totalDuration) break
      }
    } else if (imageCount >= 20 && imageCount <= 30) {
      // IDEAL CASE: 20-30 photos, space evenly
      console.log(`📸 Ideal photo count (${imageCount}) - spacing evenly`)

      const timePerImage = totalDuration / imageCount

      imageUrls.forEach((url, index) => {
        displayPlan.push({
          imageUrl: url,
          startTime: index * timePerImage,
          endTime: (index + 1) * timePerImage,
          duration: timePerImage,
          isReused: false,
          priority: 3,
        })
      })
    } else if (imageCount > 30) {
      // TOO MANY PHOTOS: Prioritize and compress
      console.log(`📸 Too many photos (${imageCount}) - prioritizing key images`)

      // Prioritize key images (first 20-25 images, assuming they're ordered by importance)
      const maxImagesToShow = Math.min(25, Math.floor(totalDuration / 2)) // Min 2s per image
      const selectedImages = imageUrls.slice(0, maxImagesToShow)
      const timePerImage = totalDuration / selectedImages.length

      selectedImages.forEach((url, index) => {
        displayPlan.push({
          imageUrl: url,
          startTime: index * timePerImage,
          endTime: (index + 1) * timePerImage,
          duration: timePerImage,
          isReused: false,
          priority: index < 10 ? 5 : 3, // First 10 are high priority
        })
      })
    } else {
      // DEFAULT CASE: Space evenly
      const timePerImage = totalDuration / imageCount

      imageUrls.forEach((url, index) => {
        displayPlan.push({
          imageUrl: url,
          startTime: index * timePerImage,
          endTime: (index + 1) * timePerImage,
          duration: timePerImage,
          isReused: false,
          priority: 3,
        })
      })
    }

    // Log the final plan
    console.log(`📸 Final plan: ${displayPlan.length} image slots`)
    console.log(`📸 Average time per image: ${(totalDuration / displayPlan.length).toFixed(1)}s`)
    console.log(`📸 Reused images: ${displayPlan.filter((p) => p.isReused).length}`)

    displayPlan.forEach((plan, index) => {
      console.log(
        `📸 Image ${index + 1}: ${plan.duration.toFixed(1)}s ${plan.isReused ? "(REUSED)" : ""} Priority: ${plan.priority}`,
      )
    })

    return displayPlan
  }, [])

  const extractHighlightCaptions = useCallback(
    (script: string, duration: number): HighlightCaption[] => {
      const highlights: HighlightCaption[] = []
      const scriptLower = script.toLowerCase()

      console.log("🎯 Extracting key highlights from script...")

      if (scriptLower.includes("attention") || scriptLower.includes("stop") || scriptLower.includes("look")) {
        highlights.push({
          text: "🔥 ATTENTION HOME BUYERS",
          startTime: 0.5,
          endTime: 3.5,
          priority: 5,
        })
      } else {
        highlights.push({
          text: "🏠 STUNNING PROPERTY ALERT",
          startTime: 0.5,
          endTime: 3.5,
          priority: 5,
        })
      }

      const bedroomText = propertyData.bedrooms === 1 ? "1 BEDROOM" : `${propertyData.bedrooms} BEDROOMS`
      const bathroomText =
        propertyData.bathrooms === 1
          ? "1 BATH"
          : propertyData.bathrooms === 1.5
            ? "1.5 BATHS"
            : propertyData.bathrooms === 2.5
              ? "2.5 BATHS"
              : propertyData.bathrooms === 3.5
                ? "3.5 BATHS"
                : `${propertyData.bathrooms} BATHS`

      highlights.push({
        text: `${bedroomText}, ${bathroomText}`.toUpperCase(),
        startTime: duration * 0.15,
        endTime: duration * 0.25,
        priority: 4,
      })

      highlights.push({
        text: `${propertyData.sqft.toLocaleString()} SQ FT OF LUXURY`.toUpperCase(),
        startTime: duration * 0.25,
        endTime: duration * 0.35,
        priority: 4,
      })

      let featureText = "PREMIUM FEATURES THROUGHOUT"

      if (propertyData.propertyDescription) {
        const desc = propertyData.propertyDescription.toLowerCase()
        if (desc.includes("kitchen")) featureText = "LUXURY KITCHEN W/ UPGRADES"
        else if (desc.includes("pool")) featureText = "SPARKLING POOL + OUTDOOR SPACE"
        else if (desc.includes("garage")) featureText = "2-CAR GARAGE + STORAGE"
        else if (desc.includes("fireplace")) featureText = "COZY FIREPLACE + OPEN FLOOR PLAN"
        else if (desc.includes("master")) featureText = "SPACIOUS MASTER SUITE"
        else if (desc.includes("yard") || desc.includes("backyard")) featureText = "PRIVATE BACKYARD OASIS"
      } else if (scriptLower.includes("kitchen")) {
        featureText = "GOURMET KITCHEN W/ ISLAND"
      } else if (scriptLower.includes("garage")) {
        featureText = "ATTACHED GARAGE + DRIVEWAY"
      }

      highlights.push({
        text: featureText.toUpperCase(),
        startTime: duration * 0.35,
        endTime: duration * 0.55,
        priority: 3,
      })

      const locationParts = propertyData.address.split(",")
      const city = locationParts.length > 1 ? locationParts[1].trim().toUpperCase() : "PRIME LOCATION"

      highlights.push({
        text: `📍 ${city} – PRIME LOCATION`.toUpperCase(),
        startTime: duration * 0.55,
        endTime: duration * 0.7,
        priority: 3,
      })

      const priceText =
        propertyData.price >= 1000000
          ? `$${(propertyData.price / 1000000).toFixed(1)}M – INCREDIBLE VALUE`
          : `$${(propertyData.price / 1000).toFixed(0)}K – WON'T LAST LONG`

      highlights.push({
        text: priceText.toUpperCase(),
        startTime: duration * 0.7,
        endTime: duration * 0.85,
        priority: 5,
      })

      if (scriptLower.includes("dm") || scriptLower.includes("message")) {
        highlights.push({
          text: "📱 DM ME NOW!",
          startTime: duration * 0.85,
          endTime: duration - 0.5,
          priority: 5,
        })
      } else if (scriptLower.includes("call")) {
        highlights.push({
          text: "📞 CALL TODAY!",
          startTime: duration * 0.85,
          endTime: duration - 0.5,
          priority: 5,
        })
      } else {
        highlights.push({
          text: "💬 CONTACT ME TODAY!",
          startTime: duration * 0.85,
          endTime: duration - 0.5,
          priority: 4,
        })
      }

      console.log(`✅ Created ${highlights.length} highlight captions`)
      highlights.forEach((h, i) => {
        console.log(`   ${i + 1}. "${h.text}" (${h.startTime.toFixed(1)}s - ${h.endTime.toFixed(1)}s)`)
      })

      return highlights
    },
    [propertyData],
  )

  // SMART CAPTION RENDERING WITH AUTO-SCALING
  const calculateCaptionRenderInfo = useCallback(
    (ctx: CanvasRenderingContext2D, text: string, canvas: HTMLCanvasElement, priority: number): CaptionRenderInfo => {
      // Ensure text is uppercase for consistent measurement
      const displayText = text.toUpperCase()

      const maxWidth = canvas.width * 0.9 // 90% of video width
      const bottomPadding = canvas.height * 0.1 // 10% padding from bottom for consistent placement

      // Consistent base font size calculation
      let baseFontSize = Math.floor(canvas.width * 0.08) // Slightly smaller base for consistency

      // Priority-based sizing adjustments
      if (priority >= 5) baseFontSize = Math.floor(canvas.width * 0.095) // High priority slightly larger
      if (priority <= 2) baseFontSize = Math.floor(canvas.width * 0.07) // Low priority slightly smaller

      // Length-based adjustments
      if (displayText.length > 30) baseFontSize = Math.floor(canvas.width * 0.065)
      if (displayText.length > 45) baseFontSize = Math.floor(canvas.width * 0.055)

      let fontSize = baseFontSize
      let autoScaled = false

      // Test if text fits at base size
      ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`
      let textWidth = ctx.measureText(displayText).width

      // Auto-scale down if too wide
      while (textWidth > maxWidth && fontSize > canvas.width * 0.04) {
        fontSize -= 2
        ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`
        textWidth = ctx.measureText(displayText).width
        autoScaled = true
      }

      // Smart line breaking
      const words = displayText.split(" ")
      const lines: string[] = []

      if (textWidth <= maxWidth) {
        // Single line fits
        lines.push(displayText)
      } else {
        // Multi-line breaking
        let currentLine = ""

        for (const word of words) {
          const testLine = currentLine + (currentLine ? " " : "") + word
          const testWidth = ctx.measureText(testLine).width

          if (testWidth <= maxWidth) {
            currentLine = testLine
          } else {
            if (currentLine) {
              lines.push(currentLine)
              currentLine = word
            } else {
              // Single word too long, force it
              lines.push(word)
            }
          }
        }

        if (currentLine) {
          lines.push(currentLine)
        }

        // Avoid single words on their own line (except if stylistic)
        if (lines.length > 1 && lines[lines.length - 1].split(" ").length === 1 && lines.length > 2) {
          const lastWord = lines.pop()!
          lines[lines.length - 1] += " " + lastWord
        }
      }

      // Consistent positioning calculation
      const lineHeight = fontSize * 1.3
      const totalTextHeight = lines.length * lineHeight
      const startY = canvas.height - bottomPadding - totalTextHeight + lineHeight * 0.8

      return {
        fontSize,
        lines,
        x: canvas.width / 2, // Always center horizontally
        y: startY,
        autoScaled,
        maxWidth,
      }
    },
    [],
  )

  const drawHighlightCaption = useCallback(
    (ctx: CanvasRenderingContext2D, caption: HighlightCaption, canvas: HTMLCanvasElement, currentTime: number) => {
      const { text, startTime, endTime, priority } = caption

      // Ensure text is always uppercase
      const displayText = text.toUpperCase()

      // Calculate opacity with fade in/out
      let opacity = 1
      if (currentTime < startTime + 0.5) {
        opacity = (currentTime - startTime) / 0.5
      } else if (currentTime > endTime - 0.5) {
        opacity = (endTime - currentTime) / 0.5
      }
      opacity = Math.max(0, Math.min(1, opacity))

      if (opacity <= 0) return

      // Get smart rendering info
      const renderInfo = calculateCaptionRenderInfo(ctx, displayText, canvas, priority)

      // Set consistent font styling
      ctx.font = `900 ${renderInfo.fontSize}px "Arial Black", Arial, sans-serif`
      ctx.textAlign = "center"

      // Draw each line with consistent styling
      renderInfo.lines.forEach((line, lineIndex) => {
        const y = renderInfo.y + lineIndex * (renderInfo.fontSize * 1.3)

        // Ensure line is uppercase
        const displayLine = line.toUpperCase()

        // Background box for readability
        const textMetrics = ctx.measureText(displayLine)
        const textWidth = textMetrics.width
        const padding = renderInfo.fontSize * 0.6
        const boxWidth = textWidth + padding * 2
        const boxHeight = renderInfo.fontSize + padding
        const boxX = (canvas.width - boxWidth) / 2
        const boxY = y - renderInfo.fontSize * 0.9

        // Consistent semi-transparent black background
        ctx.fillStyle = `rgba(0, 0, 0, ${0.85 * opacity})`
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight)

        // Primary black stroke for depth
        ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`
        ctx.lineWidth = Math.floor(renderInfo.fontSize * 0.2)
        ctx.strokeText(displayLine, renderInfo.x, y)

        // Secondary shadow stroke
        ctx.strokeStyle = `rgba(0, 0, 0, ${0.7 * opacity})`
        ctx.lineWidth = Math.floor(renderInfo.fontSize * 0.1)
        ctx.strokeText(displayLine, renderInfo.x + 3, y + 3)

        // CONSISTENT BRIGHT YELLOW TEXT - This is the main text color
        ctx.fillStyle = `rgba(255, 255, 0, ${opacity})`
        ctx.fillText(displayLine, renderInfo.x, y)

        // High priority glow effect (optional enhancement)
        if (priority >= 4) {
          ctx.shadowColor = `rgba(255, 255, 0, ${0.3 * opacity})`
          ctx.shadowBlur = 8
          ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * opacity})`
          ctx.fillText(displayLine, renderInfo.x, y)
          ctx.shadowBlur = 0
        }
      })
    },
    [calculateCaptionRenderInfo],
  )

  const generateAudio = useCallback(
    async (script: string) => {
      setProgress(10)

      const response = await fetch("/api/generate-complete-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(propertyData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || "Audio generation failed")
      }

      return data
    },
    [propertyData],
  )

  const generatePerfectVideo = useCallback(async () => {
    try {
      if (!canvasRef.current) {
        throw new Error("Canvas not available")
      }

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      canvas.width = 576
      canvas.height = 1024

      console.log("🎬 Starting SMART video generation with dynamic image timing")

      const audioData = await generateAudio(propertyData.script)
      setProgress(20)

      if (!audioData.audioUrl) {
        throw new Error("Failed to generate audio")
      }

      console.log(`🎵 Audio duration: ${audioData.duration}s`)

      // Create smart image display plan
      const imageDisplayPlan = createImageDisplayPlan(propertyData.imageUrls, audioData.duration)

      const audio = audioRef.current!
      audio.src = audioData.audioUrl
      audio.preload = "auto"
      audio.crossOrigin = "anonymous"
      audio.volume = 1.0
      audio.muted = false

      await new Promise((resolve, reject) => {
        audio.oncanplaythrough = () => {
          console.log("✅ Audio loaded and ready at FULL VOLUME")
          resolve(null)
        }
        audio.onerror = reject
        audio.load()
      })

      setProgress(30)

      const highlightCaptions = extractHighlightCaptions(propertyData.script, audioData.duration)

      setProgress(40)

      // Load images according to display plan
      const loadedImages: { [key: string]: HTMLImageElement } = {}
      const uniqueImageUrls = [...new Set(imageDisplayPlan.map((plan) => plan.imageUrl))]

      for (let i = 0; i < uniqueImageUrls.length; i++) {
        try {
          const img = await loadImage(uniqueImageUrls[i])
          loadedImages[uniqueImageUrls[i]] = img
          setProgress(40 + (i / uniqueImageUrls.length) * 20)
        } catch (error) {
          console.warn(`⚠️ Failed to load image ${i + 1}: ${error}`)
        }
      }

      if (Object.keys(loadedImages).length === 0) {
        throw new Error("No images could be loaded")
      }

      console.log(`✅ Loaded ${Object.keys(loadedImages).length} unique images`)

      setProgress(60)

      const canvasStream = canvas.captureStream(30)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioSource = audioContext.createMediaElementSource(audio)
      const gainNode = audioContext.createGain()
      gainNode.gain.value = 2.0
      const audioDestination = audioContext.createMediaStreamDestination()

      audioSource.connect(gainNode)
      gainNode.connect(audioDestination)

      const combinedStream = new MediaStream()
      canvasStream.getVideoTracks().forEach((track) => {
        combinedStream.addTrack(track)
      })
      audioDestination.stream.getAudioTracks().forEach((track) => {
        combinedStream.addTrack(track)
      })

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 3000000,
        audioBitsPerSecond: 256000,
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      setProgress(70)

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log(`🏁 Recording complete: ${chunksRef.current.length} chunks`)

        try {
          await audioContext.close()
        } catch (e) {
          console.warn("Audio context cleanup:", e)
        }

        try {
          if (chunksRef.current.length === 0) {
            throw new Error("No video data recorded")
          }

          setProgress(95)

          const videoBlob = new Blob(chunksRef.current, {
            type: "video/webm",
          })

          console.log(`✅ SMART video created: ${videoBlob.size} bytes with optimized image timing`)

          const videoUrl = URL.createObjectURL(videoBlob)
          setProgress(100)

          onVideoGenerated(videoUrl)
        } catch (error) {
          console.error("❌ Video creation failed:", error)
          onError(error instanceof Error ? error.message : "Video creation failed")
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event)
        onError("Recording failed")
      }

      setProgress(75)

      console.log("🎬 Starting SYNCHRONIZED recording with smart image timing...")

      mediaRecorder.start(100)
      await new Promise((resolve) => setTimeout(resolve, 100))

      audio.currentTime = 0
      await audio.play()

      console.log("🎵 Audio and video recording started SIMULTANEOUSLY")

      const recordingStartTime = Date.now()
      const durationMs = audioData.duration * 1000

      const animate = () => {
        const elapsed = Date.now() - recordingStartTime
        const elapsedSeconds = elapsed / 1000

        if (elapsed >= durationMs) {
          console.log("🏁 Animation complete - stopping recording")
          audio.pause()
          mediaRecorder.stop()
          return
        }

        // Find current image based on smart display plan
        const currentImagePlan = imageDisplayPlan.find(
          (plan) => elapsedSeconds >= plan.startTime && elapsedSeconds < plan.endTime,
        )

        const currentHighlight = highlightCaptions.find(
          (caption) => elapsedSeconds >= caption.startTime && elapsedSeconds < caption.endTime,
        )

        if (currentImagePlan) {
          const img = loadedImages[currentImagePlan.imageUrl]
          if (img && img.complete) {
            ctx.fillStyle = "#000000"
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
            const scaledWidth = img.width * scale
            const scaledHeight = img.height * scale
            const x = (canvas.width - scaledWidth) / 2
            const y = (canvas.height - scaledHeight) / 2

            ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

            if (currentHighlight) {
              drawHighlightCaption(ctx, currentHighlight, canvas, elapsedSeconds)
            }

            // Property overlay
            const overlayGradient = ctx.createLinearGradient(0, 0, 0, 100)
            overlayGradient.addColorStop(0, "rgba(0, 0, 0, 0.9)")
            overlayGradient.addColorStop(1, "rgba(0, 0, 0, 0.3)")
            ctx.fillStyle = overlayGradient
            ctx.fillRect(0, 0, canvas.width, 100)

            ctx.fillStyle = "#FFFFFF"
            ctx.font = "bold 18px Arial"
            ctx.textAlign = "left"
            ctx.fillText(propertyData.address, 20, 30)

            ctx.fillStyle = "#FFD700"
            ctx.font = "bold 16px Arial"
            ctx.fillText(`$${propertyData.price.toLocaleString()}`, 20, 50)

            ctx.fillStyle = "#FFFFFF"
            ctx.font = "14px Arial"
            ctx.fillText(
              `${propertyData.bedrooms}BR • ${propertyData.bathrooms}BA • ${propertyData.sqft.toLocaleString()} sqft`,
              20,
              70,
            )
          }
        }

        const recordingProgress = 75 + (elapsed / durationMs) * 20
        setProgress(Math.min(recordingProgress, 95))

        animationRef.current = requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("❌ SMART video generation failed:", error)
      onError(error instanceof Error ? error.message : "Video generation failed")
    }
  }, [
    propertyData,
    generateAudio,
    loadImage,
    createImageDisplayPlan,
    extractHighlightCaptions,
    drawHighlightCaption,
    onVideoGenerated,
    onError,
  ])

  useEffect(() => {
    generatePerfectVideo()
  }, [generatePerfectVideo])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={576} height={1024} />
      <audio ref={audioRef} preload="auto" className="hidden" />

      <div className="bg-white/80 backdrop-blur-sm border rounded-lg p-6 shadow-lg">
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-700 mb-6">{Math.round(progress)}%</div>
          <Progress value={progress} className="h-6" />
        </div>
      </div>
    </div>
  )
}
