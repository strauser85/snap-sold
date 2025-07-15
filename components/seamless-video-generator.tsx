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

  // PHOTO-BASED IMAGE DISPLAY PLANNING WITH SMOOTH TRANSITIONS
  const createPhotoBasedImageDisplayPlan = useCallback(
    (imageUrls: string[], totalDuration: number, introTime: number, outroTime: number): ImageDisplayPlan[] => {
      const imageCount = imageUrls.length
      console.log(`📸 Creating photo-based display plan for ${imageCount} images`)
      console.log(`📊 Total: ${totalDuration}s, Intro: ${introTime}s, Outro: ${outroTime}s`)

      const displayPlan: ImageDisplayPlan[] = []
      const photoDisplayTime = totalDuration - introTime - outroTime
      const timePerPhoto = photoDisplayTime / imageCount

      console.log(`📸 Photo display time: ${photoDisplayTime}s (${timePerPhoto.toFixed(2)}s per photo)`)

      // Create evenly spaced photo timeline
      imageUrls.forEach((url, index) => {
        const startTime = introTime + index * timePerPhoto
        const endTime = introTime + (index + 1) * timePerPhoto

        displayPlan.push({
          imageUrl: url,
          startTime,
          endTime,
          duration: timePerPhoto,
          isReused: false,
          priority: index < 3 ? 5 : 3, // First 3 photos are high priority
        })

        console.log(
          `📸 Photo ${index + 1}: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${timePerPhoto.toFixed(2)}s)`,
        )
      })

      console.log(`✅ Photo-based plan complete: ${displayPlan.length} photos evenly spaced`)
      return displayPlan
    },
    [],
  )

  const extractHighlightCaptions = useCallback(
    (script: string, duration: number): HighlightCaption[] => {
      const highlights: HighlightCaption[] = []
      const scriptLower = script.toLowerCase()

      console.log("🎯 Extracting highlights for photo-based timing...")

      // INTRO CAPTION (during intro time)
      if (scriptLower.includes("attention") || scriptLower.includes("stop") || scriptLower.includes("look")) {
        highlights.push({
          text: "🔥 ATTENTION HOME BUYERS",
          startTime: 0.2,
          endTime: 1.3,
          priority: 5,
        })
      } else {
        highlights.push({
          text: "🏠 STUNNING PROPERTY ALERT",
          startTime: 0.2,
          endTime: 1.3,
          priority: 5,
        })
      }

      // PROPERTY DETAILS (early in photo sequence)
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
        startTime: duration * 0.2,
        endTime: duration * 0.35,
        priority: 4,
      })

      highlights.push({
        text: `${propertyData.sqft.toLocaleString()} SQ FT OF LUXURY`.toUpperCase(),
        startTime: duration * 0.35,
        endTime: duration * 0.5,
        priority: 4,
      })

      // FEATURE HIGHLIGHT (middle of photo sequence)
      let featureText = "PREMIUM FEATURES THROUGHOUT"
      if (propertyData.propertyDescription) {
        const desc = propertyData.propertyDescription.toLowerCase()
        if (desc.includes("kitchen")) featureText = "LUXURY KITCHEN W/ UPGRADES"
        else if (desc.includes("pool")) featureText = "SPARKLING POOL + OUTDOOR SPACE"
        else if (desc.includes("garage")) featureText = "2-CAR GARAGE + STORAGE"
        else if (desc.includes("fireplace")) featureText = "COZY FIREPLACE + OPEN FLOOR PLAN"
      }

      highlights.push({
        text: featureText.toUpperCase(),
        startTime: duration * 0.5,
        endTime: duration * 0.7,
        priority: 3,
      })

      // PRICE HIGHLIGHT (late in photo sequence)
      const priceText =
        propertyData.price >= 1000000
          ? `$${(propertyData.price / 1000000).toFixed(1)}M – INCREDIBLE VALUE`
          : `$${(propertyData.price / 1000).toFixed(0)}K – WON'T LAST LONG`

      highlights.push({
        text: priceText.toUpperCase(),
        startTime: duration * 0.7,
        endTime: duration * 0.9,
        priority: 5,
      })

      // CALL TO ACTION (outro time)
      if (scriptLower.includes("dm") || scriptLower.includes("message")) {
        highlights.push({
          text: "📱 DM ME NOW!",
          startTime: duration * 0.9,
          endTime: duration - 0.2,
          priority: 5,
        })
      } else if (scriptLower.includes("call")) {
        highlights.push({
          text: "📞 CALL TODAY!",
          startTime: duration * 0.9,
          endTime: duration - 0.2,
          priority: 5,
        })
      } else {
        highlights.push({
          text: "💬 CONTACT ME TODAY!",
          startTime: duration * 0.9,
          endTime: duration - 0.2,
          priority: 4,
        })
      }

      console.log(`✅ Created ${highlights.length} photo-timed highlight captions`)
      highlights.forEach((h, i) => {
        console.log(`   ${i + 1}. "${h.text}" (${h.startTime.toFixed(1)}s - ${h.endTime.toFixed(1)}s)`)
      })

      return highlights
    },
    [propertyData],
  )

  // OPTIMIZED CAPTION RENDERING - CONSISTENT STYLING
  const calculateCaptionRenderInfo = useCallback(
    (ctx: CanvasRenderingContext2D, text: string, canvas: HTMLCanvasElement, priority: number): CaptionRenderInfo => {
      const displayText = text.toUpperCase()
      const maxWidth = canvas.width * 0.9
      const bottomPadding = canvas.height * 0.1

      // FIXED FONT SIZE - CONSISTENT ACROSS ALL CAPTIONS
      const fontSize = Math.floor(canvas.width * 0.08)
      ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`

      // SIMPLE LINE BREAKING
      const words = displayText.split(" ")
      const lines: string[] = []
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
            lines.push(word)
          }
        }
      }
      if (currentLine) {
        lines.push(currentLine)
      }

      const lineHeight = fontSize * 1.3
      const totalTextHeight = lines.length * lineHeight
      const startY = canvas.height - bottomPadding - totalTextHeight + lineHeight * 0.8

      return {
        fontSize,
        lines,
        x: canvas.width / 2,
        y: startY,
        autoScaled: false,
        maxWidth,
      }
    },
    [],
  )

  const drawHighlightCaption = useCallback(
    (ctx: CanvasRenderingContext2D, caption: HighlightCaption, canvas: HTMLCanvasElement, currentTime: number) => {
      const { text, startTime, endTime } = caption
      const displayText = text.toUpperCase()

      // SMOOTH FADE TRANSITIONS
      let opacity = 1
      const fadeTime = 0.3 // Quick fade for smooth transitions
      if (currentTime < startTime + fadeTime) {
        opacity = (currentTime - startTime) / fadeTime
      } else if (currentTime > endTime - fadeTime) {
        opacity = (endTime - currentTime) / fadeTime
      }
      opacity = Math.max(0, Math.min(1, opacity))

      if (opacity <= 0) return

      // CONSISTENT FONT SIZE
      const fontSize = Math.floor(canvas.width * 0.08)
      ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`
      ctx.textAlign = "center"

      // FAST LINE BREAKING
      const maxWidth = canvas.width * 0.9
      const words = displayText.split(" ")
      const lines: string[] = []
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
            lines.push(word)
          }
        }
      }
      if (currentLine) {
        lines.push(currentLine)
      }

      // CONSISTENT POSITIONING
      const lineHeight = fontSize * 1.3
      const bottomPadding = canvas.height * 0.1
      const totalTextHeight = lines.length * lineHeight
      const startY = canvas.height - bottomPadding - totalTextHeight + lineHeight * 0.8

      // STREAMLINED DRAWING WITH SMOOTH TRANSITIONS
      lines.forEach((line, lineIndex) => {
        const y = startY + lineIndex * lineHeight

        // BACKGROUND BOX
        const textMetrics = ctx.measureText(line)
        const textWidth = textMetrics.width
        const padding = fontSize * 0.6
        const boxWidth = textWidth + padding * 2
        const boxHeight = fontSize + padding
        const boxX = (canvas.width - boxWidth) / 2
        const boxY = y - fontSize * 0.9

        ctx.fillStyle = `rgba(0, 0, 0, ${0.85 * opacity})`
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight)

        // TEXT STROKE
        ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`
        ctx.lineWidth = Math.floor(fontSize * 0.15)
        ctx.strokeText(line, canvas.width / 2, y)

        // BRIGHT YELLOW TEXT
        ctx.fillStyle = `rgba(255, 255, 0, ${opacity})`
        ctx.fillText(line, canvas.width / 2, y)
      })
    },
    [],
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

      // TIKTOK OPTIMIZED RESOLUTION - 1080x1920 for better quality
      canvas.width = 1080
      canvas.height = 1920

      console.log("🎬 Starting PHOTO-BASED video generation - 1080x1920 MP4")

      const audioData = await generateAudio(propertyData.script)
      setProgress(20)

      if (!audioData.audioUrl) {
        throw new Error("Failed to generate audio")
      }

      console.log(`🎵 Audio duration: ${audioData.duration}s`)
      console.log(`📸 Video based on ${propertyData.imageUrls.length} photos`)
      console.log(`📊 Duration breakdown:`, audioData.videoDuration)

      // Create PHOTO-BASED image display plan
      const imageDisplayPlan = createPhotoBasedImageDisplayPlan(
        propertyData.imageUrls,
        audioData.duration,
        audioData.videoDuration.intro,
        audioData.videoDuration.outro,
      )

      const audio = audioRef.current!
      audio.src = audioData.audioUrl
      audio.preload = "auto"
      audio.crossOrigin = "anonymous"
      audio.volume = 1.0
      audio.muted = false

      await new Promise((resolve, reject) => {
        audio.oncanplaythrough = () => {
          console.log("✅ Audio loaded and ready")
          resolve(null)
        }
        audio.onerror = reject
        audio.load()
      })

      setProgress(30)

      const highlightCaptions = extractHighlightCaptions(propertyData.script, audioData.duration)
      setProgress(40)

      // PARALLEL IMAGE LOADING for faster processing
      const loadedImages: { [key: string]: HTMLImageElement } = {}
      const uniqueImageUrls = [...new Set(imageDisplayPlan.map((plan) => plan.imageUrl))]

      const imagePromises = uniqueImageUrls.map(async (url, index) => {
        try {
          const img = await loadImage(url)
          loadedImages[url] = img
          setProgress(40 + ((index + 1) / uniqueImageUrls.length) * 20)
          return img
        } catch (error) {
          console.warn(`⚠️ Failed to load image ${index + 1}:`, error)
          return null
        }
      })

      await Promise.all(imagePromises)

      if (Object.keys(loadedImages).length === 0) {
        throw new Error("No images could be loaded")
      }

      console.log(`✅ FAST loaded ${Object.keys(loadedImages).length} images`)
      setProgress(60)

      // OPTIMIZED STREAM SETUP
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

      // MP4 WITH H.264 AND AAC - MAXIMUM COMPATIBILITY
      let mediaRecorder: MediaRecorder

      // Try modern MP4 format first
      if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264,aac")) {
        mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: "video/mp4;codecs=h264,aac",
          videoBitsPerSecond: 5000000, // Higher bitrate for 1080p
          audioBitsPerSecond: 256000,
        })
        console.log("✅ Using MP4 with H.264/AAC")
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: "video/mp4",
          videoBitsPerSecond: 5000000,
          audioBitsPerSecond: 256000,
        })
        console.log("✅ Using MP4 (generic)")
      } else {
        // Fallback to WebM if MP4 not supported
        mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: "video/webm;codecs=vp9,opus",
          videoBitsPerSecond: 5000000,
          audioBitsPerSecond: 256000,
        })
        console.log("⚠️ Fallback to WebM")
      }

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

          // Create MP4 blob
          const videoBlob = new Blob(chunksRef.current, {
            type: mediaRecorder.mimeType.includes("mp4") ? "video/mp4" : "video/webm",
          })

          console.log(`✅ PHOTO-BASED video created: ${videoBlob.size} bytes (${mediaRecorder.mimeType})`)

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
      console.log("🎬 Starting PHOTO-BASED recording...")

      mediaRecorder.start(100)
      await new Promise((resolve) => setTimeout(resolve, 100))

      audio.currentTime = 0
      await audio.play()

      console.log("🎵 Audio and video recording started with photo-based timing")

      const recordingStartTime = Date.now()
      const durationMs = audioData.duration * 1000

      const animate = () => {
        const elapsed = Date.now() - recordingStartTime
        const elapsedSeconds = elapsed / 1000

        if (elapsed >= durationMs) {
          console.log("🏁 Animation complete")
          audio.pause()
          mediaRecorder.stop()
          return
        }

        // FIND CURRENT IMAGE BASED ON PHOTO-BASED TIMING
        const currentImagePlan = imageDisplayPlan.find(
          (plan) => elapsedSeconds >= plan.startTime && elapsedSeconds < plan.endTime,
        )

        const currentHighlight = highlightCaptions.find(
          (caption) => elapsedSeconds >= caption.startTime && elapsedSeconds < caption.endTime,
        )

        if (currentImagePlan) {
          const img = loadedImages[currentImagePlan.imageUrl]
          if (img && img.complete) {
            // SMOOTH IMAGE TRANSITIONS
            ctx.fillStyle = "#000000"
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Calculate transition progress for smooth fades
            const transitionTime = 0.2 // 0.2 second transition
            const planProgress = (elapsedSeconds - currentImagePlan.startTime) / currentImagePlan.duration
            let imageOpacity = 1

            // Fade in at start
            if (planProgress < transitionTime / currentImagePlan.duration) {
              imageOpacity = planProgress / (transitionTime / currentImagePlan.duration)
            }
            // Fade out at end
            else if (planProgress > 1 - transitionTime / currentImagePlan.duration) {
              imageOpacity = (1 - planProgress) / (transitionTime / currentImagePlan.duration)
            }

            imageOpacity = Math.max(0, Math.min(1, imageOpacity))

            // Draw image with smooth scaling
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
            const scaledWidth = img.width * scale
            const scaledHeight = img.height * scale
            const x = (canvas.width - scaledWidth) / 2
            const y = (canvas.height - scaledHeight) / 2

            ctx.globalAlpha = imageOpacity
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight)
            ctx.globalAlpha = 1

            if (currentHighlight) {
              drawHighlightCaption(ctx, currentHighlight, canvas, elapsedSeconds)
            }

            // PROPERTY OVERLAY - SCALED FOR 1080p
            const overlayGradient = ctx.createLinearGradient(0, 0, 0, 150)
            overlayGradient.addColorStop(0, "rgba(0, 0, 0, 0.9)")
            overlayGradient.addColorStop(1, "rgba(0, 0, 0, 0.3)")
            ctx.fillStyle = overlayGradient
            ctx.fillRect(0, 0, canvas.width, 150)

            ctx.fillStyle = "#FFFFFF"
            ctx.font = "bold 32px Arial" // Scaled for 1080p
            ctx.textAlign = "left"
            ctx.fillText(propertyData.address, 40, 60)

            ctx.fillStyle = "#FFD700"
            ctx.font = "bold 28px Arial"
            ctx.fillText(`$${propertyData.price.toLocaleString()}`, 40, 95)

            ctx.fillStyle = "#FFFFFF"
            ctx.font = "24px Arial"
            ctx.fillText(
              `${propertyData.bedrooms}BR • ${propertyData.bathrooms}BA • ${propertyData.sqft.toLocaleString()} sqft`,
              40,
              125,
            )
          }
        }

        const recordingProgress = 75 + (elapsed / durationMs) * 20
        setProgress(Math.min(recordingProgress, 95))

        animationRef.current = requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("❌ PHOTO-BASED video generation failed:", error)
      onError(error instanceof Error ? error.message : "Video generation failed")
    }
  }, [
    propertyData,
    generateAudio,
    loadImage,
    createPhotoBasedImageDisplayPlan,
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
      <canvas ref={canvasRef} className="hidden" width={1080} height={1920} />
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
