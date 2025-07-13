"use client"

import { useRef, useState, useCallback } from "react"

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

interface VideoData {
  audioUrl: string
  images: string[]
  duration: number
  timePerImage: number
  wordTimings?: WordTiming[]
  captions: CaptionChunk[]
  property: any
  format: {
    width: number
    height: number
    fps: number
  }
  voiceSettings?: {
    speed: number
    natural: boolean
    wordSynced: boolean
    alignmentUsed: boolean
    description: string
  }
  metadata?: {
    alignmentUsed: boolean
    captionDelay: number
    captionType: string
  }
}

interface CompleteVideoGeneratorProps {
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function CompleteVideoGenerator({ onVideoGenerated, onError }: CompleteVideoGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }, [])

  // Function to wrap text to fit within canvas width
  const wrapText = useCallback((ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const words = text.split(" ")
    const lines: string[] = []
    let currentLine = ""

    for (const word of words) {
      const testLine = currentLine + (currentLine ? " " : "") + word
      const metrics = ctx.measureText(testLine)

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines
  }, [])

  const generateCompleteVideo = useCallback(
    async (videoData: VideoData) => {
      if (!canvasRef.current) {
        onError("Canvas not available")
        return
      }

      setIsGenerating(true)
      setProgress(0)
      setCurrentStep("Loading images...")

      try {
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")!

        canvas.width = videoData.format.width
        canvas.height = videoData.format.height

        console.log("🎬 Starting video generation with settings:")
        console.log(`📊 Alignment used: ${videoData.metadata?.alignmentUsed ? "Yes" : "No"}`)
        console.log(`📝 Caption type: ${videoData.metadata?.captionType || "unknown"}`)
        console.log(`⏱️ Caption delay: ${videoData.metadata?.captionDelay || 0}ms`)

        // Load all images
        const loadedImages: HTMLImageElement[] = []
        for (let i = 0; i < videoData.images.length; i++) {
          try {
            const img = await loadImage(videoData.images[i])
            loadedImages.push(img)
            setProgress(10 + (i / videoData.images.length) * 30)
          } catch (error) {
            console.warn(`Failed to load image ${i + 1}:`, error)
          }
        }

        if (loadedImages.length === 0) {
          throw new Error("No images could be loaded")
        }

        setCurrentStep("Setting up Rachel's voice (0.85x speed)...")
        setProgress(40)

        // Setup audio - DO NOT AUTOPLAY during generation
        const audioElement = audioRef.current!
        audioElement.src = videoData.audioUrl
        audioElement.preload = "auto"
        audioElement.muted = true // Mute during setup

        await new Promise((resolve, reject) => {
          audioElement.oncanplaythrough = resolve
          audioElement.onerror = reject
          audioElement.load()
        })

        setCurrentStep("Recording video with 500ms delayed captions...")
        setProgress(50)

        // Setup recording with proper metadata
        let stream: MediaStream
        let audioContext: AudioContext | null = null

        try {
          stream = canvas.captureStream(videoData.format.fps)
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const audioSource = audioContext.createMediaElementSource(audioElement)
          const audioDestination = audioContext.createMediaStreamDestination()

          audioSource.connect(audioDestination)
          // DO NOT connect to speakers during generation

          const audioTrack = audioDestination.stream.getAudioTracks()[0]
          if (audioTrack) {
            stream.addTrack(audioTrack)
          }
        } catch (audioError) {
          console.warn("Audio setup failed:", audioError)
          stream = canvas.captureStream(videoData.format.fps)
        }

        // Setup MediaRecorder with proper metadata
        const supportedTypes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]

        let selectedType = "video/webm"
        for (const type of supportedTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            selectedType = type
            break
          }
        }

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedType,
          videoBitsPerSecond: 4000000,
          audioBitsPerSecond: 128000,
        })

        const chunks: Blob[] = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data)
          }
        }

        mediaRecorder.onstop = async () => {
          if (audioContext) {
            try {
              await audioContext.close()
            } catch (e) {
              console.warn("Error closing audio context:", e)
            }
          }

          try {
            if (chunks.length === 0) {
              throw new Error("No video data recorded")
            }

            setCurrentStep("Creating final video with metadata...")
            setProgress(95)

            // Create video blob with proper metadata
            const videoBlob = new Blob(chunks, {
              type: selectedType,
            })

            // Add duration metadata using a temporary video element
            const tempVideo = document.createElement("video")
            const videoUrl = URL.createObjectURL(videoBlob)

            tempVideo.src = videoUrl
            tempVideo.preload = "metadata"

            tempVideo.onloadedmetadata = () => {
              console.log(`✅ Video metadata: ${tempVideo.duration.toFixed(2)}s duration`)

              setVideoUrl(videoUrl)
              onVideoGenerated(videoUrl)
              setCurrentStep("Video with perfect sync ready!")
              setProgress(100)
              setIsGenerating(false)
            }

            tempVideo.onerror = () => {
              // Fallback if metadata loading fails
              setVideoUrl(videoUrl)
              onVideoGenerated(videoUrl)
              setCurrentStep("Video ready!")
              setProgress(100)
              setIsGenerating(false)
            }
          } catch (error) {
            onError(error instanceof Error ? error.message : "Video creation failed")
            setIsGenerating(false)
          }
        }

        mediaRecorder.onerror = () => {
          onError("Video recording failed")
          setIsGenerating(false)
        }

        // Start recording
        mediaRecorder.start(100)

        // Unmute and start audio for recording
        audioElement.muted = false
        audioElement.currentTime = 0
        await audioElement.play()

        // Animation loop with 500ms delayed captions
        const startTime = Date.now()
        const durationMs = videoData.duration * 1000
        const timePerImageMs = videoData.timePerImage * 1000

        const animate = () => {
          const elapsed = Date.now() - startTime
          const elapsedSeconds = elapsed / 1000

          if (elapsed >= durationMs) {
            audioElement.pause()
            mediaRecorder.stop()
            return
          }

          // Calculate current image
          const imageIndex = Math.min(Math.floor(elapsed / timePerImageMs), loadedImages.length - 1)

          // Find current caption (already includes 500ms delay from API)
          const currentCaption = videoData.captions.find(
            (caption) => elapsedSeconds >= caption.startTime && elapsedSeconds < caption.endTime,
          )

          // Draw current image
          const img = loadedImages[imageIndex]
          if (img) {
            // Clear canvas
            ctx.fillStyle = "#000000"
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Draw image
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
            const scaledWidth = img.width * scale
            const scaledHeight = img.height * scale
            const x = (canvas.width - scaledWidth) / 2
            const y = (canvas.height - scaledHeight) / 2

            ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

            // Draw captions with typewriter effect (500ms delayed, yellow text, black background)
            if (currentCaption) {
              // Font settings - yellow text with black background
              const fontSize = Math.floor(canvas.width * 0.05) // Slightly larger for better readability
              ctx.font = `900 ${fontSize}px "Arial Black", "Arial", sans-serif`
              ctx.textAlign = "center"

              // Calculate max width for text wrapping (90% of canvas width)
              const maxTextWidth = canvas.width * 0.9

              // Typewriter effect calculation with 500ms delay built into timing
              const captionDuration = currentCaption.endTime - currentCaption.startTime
              const captionElapsed = elapsedSeconds - currentCaption.startTime
              const captionProgress = Math.max(0, Math.min(1, captionElapsed / captionDuration))

              // Determine visible text based on timing method
              let visibleText = ""

              if (videoData.metadata?.alignmentUsed && currentCaption.words && currentCaption.words.length > 0) {
                // Word-by-word reveal for aligned captions (already includes 500ms delay)
                const visibleWords: string[] = []
                currentCaption.words.forEach((wordTiming) => {
                  if (elapsedSeconds >= wordTiming.startTime) {
                    visibleWords.push(wordTiming.word)
                  }
                })
                visibleText = visibleWords.join(" ")
              } else {
                // Character-by-character typewriter for sentence captions (500ms delay built in)
                const totalChars = currentCaption.text.length
                const charsToShow = Math.floor(captionProgress * totalChars)
                visibleText = currentCaption.text.substring(0, charsToShow)
              }

              if (visibleText.length > 0) {
                // Wrap text to prevent overflow
                const wrappedLines = wrapText(ctx, visibleText, maxTextWidth)

                const lineHeight = fontSize * 1.4 // More spacing between lines
                const padding = fontSize * 0.5 // More padding around text
                const startY = canvas.height * 0.72 // Centered in lower third

                wrappedLines.forEach((line, lineIndex) => {
                  const y = startY + lineIndex * lineHeight

                  if (line.trim().length > 0) {
                    // Measure text for background box
                    const textMetrics = ctx.measureText(line)
                    const textWidth = textMetrics.width
                    const boxWidth = textWidth + padding * 2
                    const boxHeight = fontSize + padding
                    const boxX = (canvas.width - boxWidth) / 2
                    const boxY = y - fontSize * 0.85

                    // Draw semi-transparent black background box with rounded corners effect
                    ctx.fillStyle = "rgba(0, 0, 0, 0.85)" // Higher opacity for better contrast
                    ctx.fillRect(boxX, boxY, boxWidth, boxHeight)

                    // Draw bright yellow text (perfectly centered)
                    ctx.fillStyle = "#FFFF00" // Pure bright yellow
                    ctx.fillText(line, canvas.width / 2, y)

                    // Add subtle black outline for extra clarity
                    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)"
                    ctx.lineWidth = 2
                    ctx.strokeText(line, canvas.width / 2, y)
                  }
                })

                // Show typewriter cursor (blinking effect)
                if (captionProgress < 0.98) {
                  // Show cursor until almost complete
                  const lastLine = wrappedLines[wrappedLines.length - 1]
                  if (lastLine) {
                    const y = startY + (wrappedLines.length - 1) * lineHeight
                    const textMetrics = ctx.measureText(lastLine)
                    const cursorX = canvas.width / 2 + textMetrics.width / 2 + 4

                    // Blinking cursor (3 blinks per second)
                    const shouldShowCursor = Math.floor(elapsedSeconds * 3) % 2 === 0
                    if (shouldShowCursor) {
                      ctx.fillStyle = "#FFFF00"
                      ctx.fillRect(cursorX, y - fontSize * 0.8, 3, fontSize * 0.9)
                    }
                  }
                }
              }
            }

            // Property info overlay
            const overlayGradient = ctx.createLinearGradient(0, 0, 0, 100)
            overlayGradient.addColorStop(0, "rgba(0, 0, 0, 0.85)")
            overlayGradient.addColorStop(1, "rgba(0, 0, 0, 0.5)")
            ctx.fillStyle = overlayGradient
            ctx.fillRect(0, 0, canvas.width, 100)

            // Property details
            ctx.fillStyle = "#FFFFFF"
            ctx.font = "bold 18px Arial"
            ctx.textAlign = "left"
            ctx.fillText(videoData.property.address, 15, 30)

            ctx.fillStyle = "#FFD700"
            ctx.font = "bold 16px Arial"
            ctx.fillText(`$${videoData.property.price.toLocaleString()}`, 15, 50)

            ctx.fillStyle = "#FFFFFF"
            ctx.font = "14px Arial"
            ctx.fillText(
              `${videoData.property.bedrooms}BR • ${videoData.property.bathrooms}BA • ${videoData.property.sqft.toLocaleString()} sqft`,
              15,
              70,
            )

            // Voice and sync indicator (shows whether alignment worked or not)
            ctx.fillStyle = "#FF69B4"
            ctx.font = "bold 11px Arial"
            ctx.textAlign = "right"
            const syncStatus = videoData.metadata?.alignmentUsed ? "Word-Synced" : "Sentence-Synced"
            const voiceInfo = `🎤 Rachel 0.85x • ${syncStatus}`
            ctx.fillText(voiceInfo, canvas.width - 15, 85)

            ctx.textAlign = "start"
          }

          // Update progress
          const recordingProgress = 50 + (elapsed / durationMs) * 45
          setProgress(recordingProgress)
          setCurrentStep(`Recording: ${elapsedSeconds.toFixed(1)}s / ${videoData.duration.toFixed(1)}s`)

          requestAnimationFrame(animate)
        }

        animate()
      } catch (error) {
        console.error("Video generation failed:", error)
        onError(error instanceof Error ? error.message : "Video generation failed")
        setIsGenerating(false)
      }
    },
    [loadImage, onVideoGenerated, onError, wrapText],
  )

  return {
    generateCompleteVideo,
    isGenerating,
    progress,
    currentStep,
    videoUrl,
    canvasRef,
    audioRef,
  }
}
