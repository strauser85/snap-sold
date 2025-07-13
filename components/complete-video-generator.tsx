"use client"

import { useRef, useState, useCallback } from "react"

interface CaptionChunk {
  text: string
  startTime: number
  endTime: number
}

interface VideoData {
  audioUrl: string
  images: string[]
  duration: number
  timePerImage: number
  captions: CaptionChunk[]
  property: any
  format: {
    width: number
    height: number
    fps: number
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

        setCurrentStep("Setting up audio...")
        setProgress(40)

        // Setup audio
        const audioElement = audioRef.current!
        audioElement.src = videoData.audioUrl

        await new Promise((resolve, reject) => {
          audioElement.oncanplaythrough = resolve
          audioElement.onerror = reject
          audioElement.load()
        })

        setCurrentStep("Recording video with Rachel voice...")
        setProgress(50)

        // Setup recording
        let stream: MediaStream
        let audioContext: AudioContext | null = null

        try {
          stream = canvas.captureStream(videoData.format.fps)
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const audioSource = audioContext.createMediaElementSource(audioElement)
          const audioDestination = audioContext.createMediaStreamDestination()

          audioSource.connect(audioDestination)
          audioSource.connect(audioContext.destination)

          const audioTrack = audioDestination.stream.getAudioTracks()[0]
          if (audioTrack) {
            stream.addTrack(audioTrack)
          }
        } catch (audioError) {
          console.warn("Audio setup failed:", audioError)
          stream = canvas.captureStream(videoData.format.fps)
        }

        // Setup MediaRecorder
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

            setCurrentStep("Creating final video...")
            setProgress(95)

            const videoBlob = new Blob(chunks, { type: selectedType })
            const videoUrl = URL.createObjectURL(videoBlob)

            setVideoUrl(videoUrl)
            onVideoGenerated(videoUrl)
            setCurrentStep("Video generated successfully!")
            setProgress(100)
          } catch (error) {
            onError(error instanceof Error ? error.message : "Video creation failed")
          } finally {
            setIsGenerating(false)
          }
        }

        mediaRecorder.onerror = () => {
          onError("Video recording failed")
          setIsGenerating(false)
        }

        // Start recording
        mediaRecorder.start(100)
        audioElement.currentTime = 0
        await audioElement.play()

        // Animation loop with perfectly synced captions
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

          // Find current caption with precise timing
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

            // Draw perfectly synced captions with yellow text and black background bars
            if (currentCaption) {
              // Calculate typewriter progress based on precise timing
              const captionDuration = currentCaption.endTime - currentCaption.startTime
              const captionElapsed = elapsedSeconds - currentCaption.startTime
              const captionProgress = Math.max(0, Math.min(1, captionElapsed / captionDuration))

              const words = currentCaption.text.split(" ")
              const maxWordsPerLine = 3 // Reduced for better readability
              const lines: string[] = []

              // Break text into lines
              for (let i = 0; i < words.length; i += maxWordsPerLine) {
                lines.push(words.slice(i, i + maxWordsPerLine).join(" "))
              }

              // Font settings - bold yellow with comfortable size
              const fontSize = Math.floor(canvas.width * 0.055) // Slightly smaller for better fit
              ctx.font = `900 ${fontSize}px "Arial Black", "Arial", sans-serif` // Extra bold
              ctx.textAlign = "center"

              const lineHeight = fontSize * 1.4
              const padding = fontSize * 0.3
              const totalHeight = lines.length * lineHeight
              const startY = canvas.height * 0.78 // Positioned in lower third

              // Calculate total characters for typewriter effect
              const fullText = lines.join(" ")
              const totalChars = fullText.length
              const charsToShow = Math.floor(captionProgress * totalChars)

              let charCount = 0

              lines.forEach((line, lineIndex) => {
                const y = startY + lineIndex * lineHeight

                // Calculate how many characters of this line to show
                const lineStartChar = charCount
                const lineEndChar = charCount + line.length

                let visibleText = ""
                if (charsToShow > lineStartChar) {
                  const charsInThisLine = Math.min(charsToShow - lineStartChar, line.length)
                  visibleText = line.substring(0, charsInThisLine)
                }

                if (visibleText.length > 0) {
                  // Measure text for background bar
                  const textMetrics = ctx.measureText(visibleText)
                  const textWidth = textMetrics.width
                  const barWidth = textWidth + padding * 2
                  const barHeight = fontSize + padding
                  const barX = (canvas.width - barWidth) / 2
                  const barY = y - fontSize * 0.8

                  // Draw semi-transparent black background bar
                  ctx.fillStyle = "rgba(0, 0, 0, 0.75)" // 75% opacity black
                  ctx.fillRect(barX, barY, barWidth, barHeight)

                  // Add subtle border for extra definition
                  ctx.strokeStyle = "rgba(0, 0, 0, 0.9)"
                  ctx.lineWidth = 1
                  ctx.strokeRect(barX, barY, barWidth, barHeight)

                  // Draw bold yellow text
                  ctx.fillStyle = "#FFD700" // Gold/yellow color
                  ctx.fillText(visibleText, canvas.width / 2, y)

                  // Add text shadow for extra pop
                  ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
                  ctx.shadowBlur = 2
                  ctx.shadowOffsetX = 1
                  ctx.shadowOffsetY = 1
                  ctx.fillText(visibleText, canvas.width / 2, y)

                  // Reset shadow
                  ctx.shadowColor = "transparent"
                  ctx.shadowBlur = 0
                  ctx.shadowOffsetX = 0
                  ctx.shadowOffsetY = 0

                  // Add blinking cursor effect at the end of current text
                  if (charsToShow >= lineStartChar && charsToShow <= lineEndChar && visibleText.length > 0) {
                    const cursorX = canvas.width / 2 + textWidth / 2 + 3

                    // Blinking cursor effect - faster blink for more dynamic feel
                    const blinkRate = 3 // 3 blinks per second
                    const shouldShowCursor = Math.floor(elapsedSeconds * blinkRate) % 2 === 0

                    if (shouldShowCursor && captionProgress < 0.98) {
                      // Hide cursor near end
                      ctx.fillStyle = "#FFD700"
                      ctx.fillRect(cursorX, y - fontSize * 0.7, 3, fontSize * 0.8)
                    }
                  }
                }

                charCount += line.length + 1 // +1 for space between lines
              })
            }

            // Property info overlay - improved styling
            const overlayGradient = ctx.createLinearGradient(0, 0, 0, 120)
            overlayGradient.addColorStop(0, "rgba(0, 0, 0, 0.9)")
            overlayGradient.addColorStop(1, "rgba(0, 0, 0, 0.6)")
            ctx.fillStyle = overlayGradient
            ctx.fillRect(0, 0, canvas.width, 120)

            // Property address
            ctx.fillStyle = "#FFFFFF"
            ctx.font = "bold 20px Arial"
            ctx.textAlign = "left"
            ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
            ctx.shadowBlur = 2
            ctx.fillText(videoData.property.address, 20, 35)

            // Price in gold
            ctx.fillStyle = "#FFD700"
            ctx.font = "bold 18px Arial"
            ctx.fillText(`$${videoData.property.price.toLocaleString()}`, 20, 60)

            // Property details
            ctx.fillStyle = "#FFFFFF"
            ctx.font = "16px Arial"
            ctx.fillText(
              `${videoData.property.bedrooms}BR • ${videoData.property.bathrooms}BA • ${videoData.property.sqft.toLocaleString()} sqft`,
              20,
              85,
            )

            // Rachel voice indicator
            ctx.fillStyle = "#FF69B4"
            ctx.font = "bold 14px Arial"
            ctx.textAlign = "right"
            ctx.fillText("🎤 Rachel Voice", canvas.width - 20, 105)

            // Reset shadow and text align
            ctx.shadowColor = "transparent"
            ctx.shadowBlur = 0
            ctx.textAlign = "start"
          }

          // Update progress
          const recordingProgress = 50 + (elapsed / durationMs) * 45
          setProgress(recordingProgress)
          setCurrentStep(`Recording: ${elapsedSeconds.toFixed(1)}s / ${videoData.duration}s`)

          requestAnimationFrame(animate)
        }

        animate()
      } catch (error) {
        console.error("Video generation failed:", error)
        onError(error instanceof Error ? error.message : "Video generation failed")
        setIsGenerating(false)
      }
    },
    [loadImage, onVideoGenerated, onError],
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
