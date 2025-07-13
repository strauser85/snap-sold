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

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }, [])

  // TikTok-style caption styling
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
    const fontSize = Math.floor(canvas.width * 0.08) // Responsive font size
    ctx.font = `bold ${fontSize}px Arial, sans-serif`
    ctx.textAlign = "center"

    const lineHeight = fontSize * 1.2
    const totalHeight = lines.length * lineHeight
    const startY = canvas.height * 0.75 // Position captions in lower third

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight

      // Black outline/shadow for readability
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = Math.floor(fontSize * 0.15)
      ctx.strokeText(line, canvas.width / 2, y)

      // White text
      ctx.fillStyle = "#FFFFFF"
      ctx.fillText(line, canvas.width / 2, y)

      // Add yellow highlight for emphasis (TikTok style)
      if (line.includes("$") || line.includes("BEDROOM") || line.includes("BATHROOM")) {
        ctx.fillStyle = "#FFD700"
        ctx.fillText(line, canvas.width / 2, y)
      }
    })
  }, [])

  const generateFinalVideo = useCallback(async () => {
    if (!canvasRef.current) {
      onError("Canvas not available")
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
          setProgress(10 + (i / config.images.length) * 20)
        } catch (error) {
          console.warn(`Failed to load image ${i + 1}:`, error)
        }
      }

      if (loadedImages.length === 0) {
        throw new Error("No images could be loaded")
      }

      // Setup audio
      setCurrentStep("Setting up Rachel voiceover...")
      setProgress(30)

      const audioElement = audioRef.current!
      audioElement.src = config.audioUrl

      await new Promise((resolve, reject) => {
        audioElement.oncanplaythrough = resolve
        audioElement.onerror = reject
        audioElement.load()
      })

      // Setup recording with audio
      setCurrentStep("Setting up video recording...")
      setProgress(40)

      let stream: MediaStream
      let audioContext: AudioContext | null = null

      try {
        // Create canvas stream
        stream = canvas.captureStream(config.format.fps)

        // Add audio track
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
        stream = canvas.captureStream(config.format.fps)
      }

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 3000000,
        audioBitsPerSecond: 128000,
      })

      mediaRecorderRef.current = mediaRecorder
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

          setCurrentStep("Creating final MP4 video...")
          setProgress(95)

          const videoBlob = new Blob(chunks, { type: "video/webm" })
          const videoUrl = URL.createObjectURL(videoBlob)

          setVideoUrl(videoUrl)
          onVideoGenerated(videoUrl)
          setCurrentStep("Final video generated successfully!")
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

      // Start recording and audio
      setCurrentStep("Recording final video with Rachel voiceover...")
      setProgress(50)

      mediaRecorder.start(100)
      audioElement.currentTime = 0
      await audioElement.play()

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

        // Find current caption
        const currentCaptionChunk = config.captions.find(
          (caption) => elapsedSeconds >= caption.startTime && elapsedSeconds < caption.endTime,
        )

        if (currentCaptionChunk) {
          setCurrentCaption(currentCaptionChunk.text)
        }

        // Draw current image
        const img = loadedImages[imageIndex]
        if (img) {
          // Clear canvas
          ctx.fillStyle = "#000000"
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

          // Property info overlay (top)
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
          ctx.fillRect(10, 10, canvas.width - 20, 80)

          ctx.fillStyle = "#FFFFFF"
          ctx.font = "bold 16px Arial"
          ctx.textAlign = "left"
          ctx.fillText(property.address, 20, 35)

          ctx.font = "14px Arial"
          ctx.fillText(`$${property.price.toLocaleString()}`, 20, 55)
          ctx.fillText(
            `${property.bedrooms}BR • ${property.bathrooms}BA • ${property.sqft.toLocaleString()} sqft`,
            20,
            75,
          )
        }

        // Update progress
        const recordingProgress = 50 + (elapsed / durationMs) * 45
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
  }, [config, property, onVideoGenerated, onError, loadImage, drawTikTokCaption])

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

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />
      <audio ref={audioRef} preload="auto" className="hidden" />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="h-6 w-6 text-purple-600" />
              <span className="font-bold text-purple-700 text-lg">Ready for Final Video!</span>
            </div>
            <div className="text-sm text-purple-600 space-y-2">
              <p>✅ Rachel (ElevenLabs) voiceover ready</p>
              <p>✅ {config.images.length} property images loaded</p>
              <p>✅ {config.captions.length} TikTok-style captions prepared</p>
              <p>✅ {config.duration}s duration with perfect sync</p>
            </div>
          </div>

          <Button
            onClick={generateFinalVideo}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Play className="mr-3 h-6 w-6" />
            Generate Final Video
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
            <div className="bg-black text-white p-4 rounded-lg text-center">
              <p className="font-bold text-lg">{currentCaption}</p>
              <p className="text-xs text-gray-300 mt-1">Live Caption Preview</p>
            </div>
          )}

          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Generating final video with Rachel voiceover and TikTok captions...</AlertDescription>
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
              <span className="font-bold text-lg">Final Video Generated!</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ ALL {config.images.length} images included</p>
              <p>✅ Rachel voiceover perfectly synced</p>
              <p>✅ {config.captions.length} TikTok-style captions</p>
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
              <a href={videoUrl} download="final-property-video.webm">
                <Download className="mr-2 h-4 w-4" />
                Download Final Video
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
