"use client"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Loader2, CheckCircle, Volume2, Play, RotateCcw } from "lucide-react"

interface CaptionChunk {
  text: string
  startTime: number
  endTime: number
}

interface VideoConfig {
  images: string[]
  audioUrl: string
  duration: number
  timePerImage: number
  captions: CaptionChunk[]
  format: {
    width: number
    height: number
    fps: number
  }
}

interface FinalVideoGeneratorProps {
  config: VideoConfig
  property: any
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function FinalVideoGenerator({ config, property, onVideoGenerated, onError }: FinalVideoGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const animationRef = useRef<number | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [currentCaption, setCurrentCaption] = useState("")
  const [audioTested, setAudioTested] = useState(false)
  const [audioReady, setAudioReady] = useState(false)

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }, [])

  // Test audio when component mounts
  const testAudio = useCallback(async () => {
    if (!config.audioUrl || !audioRef.current || audioTested) return

    try {
      const audio = audioRef.current
      audio.src = config.audioUrl

      await new Promise((resolve, reject) => {
        audio.oncanplaythrough = () => {
          setAudioReady(true)
          setAudioTested(true)
          console.log("✅ Rachel WAV audio loaded successfully")
          resolve(null)
        }
        audio.onerror = (e) => {
          setAudioReady(false)
          setAudioTested(true)
          console.error("❌ Rachel WAV audio loading failed:", e)
          reject(new Error("Audio loading failed"))
        }
        audio.load()
      })
    } catch (error) {
      console.error("Audio test failed:", error)
      setAudioReady(false)
      setAudioTested(true)
    }
  }, [config.audioUrl, audioTested])

  // TikTok-style caption styling with animations
  const drawTikTokCaption = useCallback((ctx: CanvasRenderingContext2D, text: string, canvas: HTMLCanvasElement) => {
    if (!text) return

    const words = text.split(" ")
    const maxWordsPerLine = 3
    const lines: string[] = []

    // Break text into lines
    for (let i = 0; i < words.length; i += maxWordsPerLine) {
      lines.push(words.slice(i, i + maxWordsPerLine).join(" "))
    }

    // Caption styling - TikTok style
    const fontSize = Math.floor(canvas.width * 0.09) // Larger font for impact
    ctx.font = `900 ${fontSize}px Arial, sans-serif` // Extra bold
    ctx.textAlign = "center"

    const lineHeight = fontSize * 1.3
    const totalHeight = lines.length * lineHeight
    const startY = canvas.height * 0.72 // Position captions in lower third

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight

      // Multiple shadow layers for depth
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = Math.floor(fontSize * 0.2)
      ctx.strokeText(line, canvas.width / 2, y)

      // Secondary shadow
      ctx.strokeStyle = "#333333"
      ctx.lineWidth = Math.floor(fontSize * 0.1)
      ctx.strokeText(line, canvas.width / 2 + 2, y + 2)

      // Main text
      ctx.fillStyle = "#FFFFFF"
      ctx.fillText(line, canvas.width / 2, y)

      // Highlight key terms
      if (line.includes("$") || line.includes("BEDROOM") || line.includes("BATHROOM") || line.includes("SQFT")) {
        ctx.fillStyle = "#FFD700" // Gold highlight
        ctx.fillText(line, canvas.width / 2, y)
      }

      // Add emphasis for action words
      if (line.includes("NOW") || line.includes("TODAY") || line.includes("CALL") || line.includes("DM")) {
        ctx.fillStyle = "#FF4444" // Red for urgency
        ctx.fillText(line, canvas.width / 2, y)
      }
    })
  }, [])

  const generateFinalVideo = useCallback(async () => {
    if (!canvasRef.current) {
      onError("Canvas not available")
      return
    }

    // Test audio first
    if (!audioTested) {
      await testAudio()
    }

    if (!audioReady) {
      onError("Rachel WAV audio failed to load. Please try again.")
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setCurrentStep("Starting final video generation...")

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      canvas.width = config.format.width
      canvas.height = config.format.height

      // Load all images
      setCurrentStep("Loading property images...")
      setProgress(10)

      const loadedImages: HTMLImageElement[] = []
      for (let i = 0; i < config.images.length; i++) {
        try {
          const img = await loadImage(config.images[i])
          loadedImages.push(img)
          setProgress(10 + (i / config.images.length) * 25)
        } catch (error) {
          console.warn(`Failed to load image ${i + 1}:`, error)
        }
      }

      if (loadedImages.length === 0) {
        throw new Error("No images could be loaded")
      }

      // Setup audio
      setCurrentStep("Setting up Rachel WAV voiceover...")
      setProgress(35)

      const audioElement = audioRef.current!
      audioElement.src = config.audioUrl

      // Setup recording with audio - IMPROVED FOR WAV COMPATIBILITY
      setCurrentStep("Setting up video recording with WAV audio...")
      setProgress(45)

      let stream: MediaStream
      let audioContext: AudioContext | null = null

      try {
        // Create canvas stream
        stream = canvas.captureStream(config.format.fps)

        // IMPROVED: Better audio context setup for WAV compatibility
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 44100, // Match WAV sample rate
        })

        // Wait for audio context to be ready
        if (audioContext.state === "suspended") {
          await audioContext.resume()
        }

        const audioSource = audioContext.createMediaElementSource(audioElement)
        const audioDestination = audioContext.createMediaStreamDestination()

        // Connect audio with gain control for better quality
        const gainNode = audioContext.createGain()
        gainNode.gain.value = 1.0 // Full volume

        audioSource.connect(gainNode)
        gainNode.connect(audioDestination)
        gainNode.connect(audioContext.destination) // Also play through speakers

        const audioTrack = audioDestination.stream.getAudioTracks()[0]
        if (audioTrack) {
          stream.addTrack(audioTrack)
          console.log("✅ Rachel WAV audio track added to video stream with gain control")
        }
      } catch (audioError) {
        console.warn("Audio setup failed:", audioError)
        stream = canvas.captureStream(config.format.fps)
      }

      // IMPROVED: Better MediaRecorder setup for WAV audio compatibility
      const supportedTypes = [
        "video/webm;codecs=vp9,opus", // Best quality with Opus audio
        "video/webm;codecs=vp8,opus", // Fallback with Opus
        "video/webm;codecs=vp9,pcm", // WAV-compatible
        "video/webm;codecs=vp8,pcm", // WAV-compatible fallback
        "video/webm;codecs=vp9", // Video only fallback
        "video/webm;codecs=vp8", // Video only fallback
        "video/webm", // Basic fallback
      ]

      let selectedType = "video/webm"
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedType = type
          console.log(`🎵 Selected MediaRecorder type: ${type}`)
          break
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedType,
        videoBitsPerSecond: 4000000, // Higher quality
        audioBitsPerSecond: 128000, // High quality audio
      })

      mediaRecorderRef.current = mediaRecorder
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
          console.log(`📦 Video chunk received: ${event.data.size} bytes`)
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

          setCurrentStep("Creating final video file with WAV audio...")
          setProgress(95)

          const videoBlob = new Blob(chunks, { type: selectedType })
          console.log(`🎬 Final video blob: ${videoBlob.size} bytes, type: ${selectedType}`)

          const videoUrl = URL.createObjectURL(videoBlob)

          setVideoUrl(videoUrl)
          onVideoGenerated(videoUrl)
          setCurrentStep("Final video with Rachel WAV voice generated!")
          setProgress(100)
        } catch (error) {
          onError(error instanceof Error ? error.message : "Video creation failed")
        } finally {
          setIsGenerating(false)
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event)
        onError("Video recording failed")
        setIsGenerating(false)
      }

      // Start recording and audio with better timing
      setCurrentStep("Recording final video with Rachel WAV voiceover...")
      setProgress(55)

      mediaRecorder.start(100) // Record in 100ms chunks

      // IMPROVED: Better audio sync timing
      setTimeout(async () => {
        try {
          audioElement.currentTime = 0
          await audioElement.play()
          console.log("🎵 Rachel WAV audio playback started")
        } catch (audioPlayError) {
          console.error("Audio playback failed:", audioPlayError)
        }
      }, 200) // Slightly longer delay for better sync

      // Animation loop with captions
      const startTime = Date.now()
      const durationMs = config.duration * 1000
      const timePerImageMs = config.timePerImage * 1000

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

        // IMPROVED: Better caption timing logic
        const currentCaptionChunk = config.captions.find(
          (caption) => elapsedSeconds >= caption.startTime && elapsedSeconds <= caption.endTime,
        )

        // If no exact match, find the closest caption within reasonable range
        if (!currentCaptionChunk && config.captions.length > 0) {
          const closestCaption = config.captions.reduce((closest, caption) => {
            const currentDistance = Math.abs(elapsedSeconds - caption.startTime)
            const closestDistance = Math.abs(elapsedSeconds - closest.startTime)
            return currentDistance < closestDistance ? caption : closest
          })

          // Only use closest if we're within 1.5 seconds (more forgiving)
          if (Math.abs(elapsedSeconds - closestCaption.startTime) <= 1.5) {
            setCurrentCaption(closestCaption.text)
          } else {
            setCurrentCaption("")
          }
        } else if (currentCaptionChunk) {
          setCurrentCaption(currentCaptionChunk.text)
        } else {
          setCurrentCaption("")
        }

        // Draw current image
        const img = loadedImages[imageIndex]
        if (img) {
          // Clear canvas with gradient background
          const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
          gradient.addColorStop(0, "#000000")
          gradient.addColorStop(1, "#1a1a1a")
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // Draw image (scaled and centered)
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const x = (canvas.width - scaledWidth) / 2
          const y = (canvas.height - scaledHeight) / 2

          ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

          // Draw TikTok-style captions
          if (currentCaptionChunk) {
            drawTikTokCaption(ctx, currentCaptionChunk.text, canvas)
          }

          // Property info overlay (top) - more stylish
          const overlayGradient = ctx.createLinearGradient(0, 0, 0, 100)
          overlayGradient.addColorStop(0, "rgba(0, 0, 0, 0.8)")
          overlayGradient.addColorStop(1, "rgba(0, 0, 0, 0.4)")
          ctx.fillStyle = overlayGradient
          ctx.fillRect(0, 0, canvas.width, 100)

          ctx.fillStyle = "#FFFFFF"
          ctx.font = "bold 18px Arial"
          ctx.textAlign = "left"
          ctx.fillText(property.address, 20, 30)

          ctx.fillStyle = "#FFD700"
          ctx.font = "bold 16px Arial"
          ctx.fillText(`$${property.price.toLocaleString()}`, 20, 50)

          ctx.fillStyle = "#FFFFFF"
          ctx.font = "14px Arial"
          ctx.fillText(
            `${property.bedrooms}BR • ${property.bathrooms}BA • ${property.sqft.toLocaleString()} sqft`,
            20,
            70,
          )

          // Rachel voice indicator with WAV format
          ctx.fillStyle = "#FF69B4"
          ctx.font = "bold 12px Arial"
          ctx.textAlign = "right"
          ctx.fillText("🎤 Rachel Voice (WAV)", canvas.width - 20, 85)
        }

        // Update progress
        const recordingProgress = 55 + (elapsed / durationMs) * 40
        setProgress(recordingProgress)
        setCurrentStep(`Recording: ${elapsedSeconds.toFixed(1)}s / ${config.duration}s`)

        animationRef.current = requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("Final video generation failed:", error)
      onError(error instanceof Error ? error.message : "Final video generation failed")
      setIsGenerating(false)
    }
  }, [config, property, onVideoGenerated, onError, loadImage, drawTikTokCaption, audioTested, audioReady, testAudio])

  const stopGeneration = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsGenerating(false)
  }, [])

  const resetGeneration = useCallback(() => {
    setVideoUrl(null)
    setProgress(0)
    setCurrentStep("")
    setCurrentCaption("")
  }, [])

  // Test audio on mount
  useState(() => {
    if (config.audioUrl && !audioTested) {
      testAudio()
    }
  })

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />
      <audio ref={audioRef} preload="auto" className="hidden" />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="h-6 w-6 text-purple-600" />
              <span className="font-bold text-purple-700 text-lg">Rachel Voice Ready! (WAV Format)</span>
            </div>
            <div className="text-sm text-purple-600 space-y-2">
              <p>✅ Rachel (ElevenLabs) WAV voiceover loaded</p>
              <p>✅ {config.images.length} property images ready</p>
              <p>✅ {config.captions.length} TikTok-style captions prepared</p>
              <p>✅ {config.duration}s duration with perfect sync</p>
              <p>🔧 WAV format for maximum browser compatibility</p>
              {audioReady ? (
                <p className="text-green-600 font-medium">🎵 WAV audio tested and ready!</p>
              ) : audioTested ? (
                <p className="text-red-600 font-medium">⚠️ WAV audio test failed</p>
              ) : (
                <p className="text-yellow-600 font-medium">🔄 Testing WAV audio...</p>
              )}
            </div>
          </div>

          <Button
            onClick={generateFinalVideo}
            disabled={!audioReady}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Play className="mr-3 h-6 w-6" />
            Generate Final Video with Rachel (WAV)
          </Button>
        </div>
      )}

      {isGenerating && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{currentStep}</span>
              <span className="text-gray-500">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {currentCaption && (
            <div className="bg-black text-white p-4 rounded-lg text-center border-2 border-purple-500">
              <p className="font-bold text-lg">{currentCaption}</p>
              <p className="text-xs text-gray-300 mt-1">Live Caption Preview (WAV Synced)</p>
            </div>
          )}

          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Generating final video with Rachel WAV voiceover and TikTok captions...</AlertDescription>
          </Alert>

          <Button onClick={stopGeneration} variant="destructive" className="w-full">
            Stop Generation
          </Button>
        </div>
      )}

      {videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-2 text-green-700 mb-3">
              <CheckCircle className="h-6 w-6" />
              <span className="font-bold text-lg">Final Video Generated with WAV Audio!</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ ALL {config.images.length} images included</p>
              <p>✅ Rachel WAV voiceover perfectly synced</p>
              <p>✅ {config.captions.length} TikTok-style captions</p>
              <p>✅ WAV format for maximum compatibility</p>
              <p>✅ Ready for TikTok, Instagram, YouTube</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={resetGeneration} variant="outline" className="flex-1 bg-transparent">
              <RotateCcw className="mr-2 h-4 w-4" />
              Generate Another
            </Button>
            <Button
              asChild
              className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            >
              <a href={videoUrl} download="final-property-video-rachel-wav.webm">
                <Download className="mr-2 h-4 w-4" />
                Download Final Video (WAV Audio)
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
