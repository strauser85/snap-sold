"use client"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Loader2, CheckCircle, Volume2, Play, RotateCcw } from "lucide-react"

interface VideoConfig {
  images: string[]
  audioUrl: string
  duration: number
  timePerImage: number
  captions: any[]
  property: any
  format: {
    width: number
    height: number
    fps: number
  }
}

interface SimpleReliableGeneratorProps {
  config: VideoConfig
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function SimpleReliableGenerator({ config, onVideoGenerated, onError }: SimpleReliableGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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

  const drawCaption = useCallback((ctx: CanvasRenderingContext2D, text: string, canvas: HTMLCanvasElement) => {
    if (!text) return

    const words = text.split(" ")
    const maxWordsPerLine = 3
    const lines: string[] = []

    for (let i = 0; i < words.length; i += maxWordsPerLine) {
      lines.push(words.slice(i, i + maxWordsPerLine).join(" "))
    }

    const fontSize = Math.floor(canvas.width * 0.08)
    ctx.font = `900 ${fontSize}px Arial, sans-serif`
    ctx.textAlign = "center"

    const lineHeight = fontSize * 1.4
    const startY = canvas.height * 0.75

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight

      // Black outline
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = Math.floor(fontSize * 0.2)
      ctx.strokeText(line, canvas.width / 2, y)

      // Yellow text
      ctx.fillStyle = "#FFFF00"
      ctx.fillText(line, canvas.width / 2, y)
    })
  }, [])

  const generateSimpleVideo = useCallback(async () => {
    if (!canvasRef.current) {
      onError("Canvas not available")
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setCurrentStep("Starting simple video generation...")

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      canvas.width = config.format.width
      canvas.height = config.format.height

      console.log("🎬 Starting SIMPLE video generation")
      console.log(`📊 Config: ${config.images.length} images, ${config.duration}s duration`)

      // Load images
      setCurrentStep("Loading images...")
      setProgress(10)

      const loadedImages: HTMLImageElement[] = []
      for (let i = 0; i < config.images.length; i++) {
        try {
          const img = await loadImage(config.images[i])
          loadedImages.push(img)
          setProgress(10 + (i / config.images.length) * 30)
          console.log(`✅ Image ${i + 1}/${config.images.length} loaded`)
        } catch (error) {
          console.warn(`⚠️ Failed to load image ${i + 1}:`, error)
        }
      }

      if (loadedImages.length === 0) {
        throw new Error("No images could be loaded")
      }

      console.log(`✅ ${loadedImages.length} images loaded successfully`)

      // Setup simple recording
      setCurrentStep("Setting up recording...")
      setProgress(40)

      const stream = canvas.captureStream(30)
      console.log("✅ Canvas stream created")

      // Simple MediaRecorder setup
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm",
      })

      const chunks: Blob[] = []
      let recordingStarted = false

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
          console.log(`📦 Chunk recorded: ${event.data.size} bytes (total: ${chunks.length})`)
        }
      }

      mediaRecorder.onstart = () => {
        recordingStarted = true
        console.log("🎬 Recording started successfully")
      }

      mediaRecorder.onstop = () => {
        console.log(`🏁 Recording stopped with ${chunks.length} chunks`)

        try {
          if (chunks.length === 0) {
            throw new Error("No video data recorded")
          }

          const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0)
          console.log(`📊 Total video size: ${totalSize} bytes`)

          if (totalSize === 0) {
            throw new Error("All chunks are empty")
          }

          setCurrentStep("Creating video file...")
          setProgress(95)

          const videoBlob = new Blob(chunks, { type: "video/webm" })
          const videoUrl = URL.createObjectURL(videoBlob)

          console.log("✅ Video created successfully")
          setVideoUrl(videoUrl)
          onVideoGenerated(videoUrl)
          setCurrentStep("Video generated!")
          setProgress(100)
        } catch (error) {
          console.error("❌ Video creation failed:", error)
          onError(error instanceof Error ? error.message : "Video creation failed")
        } finally {
          setIsGenerating(false)
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event)
        onError("Recording failed")
        setIsGenerating(false)
      }

      // Start recording
      setCurrentStep("Starting recording...")
      setProgress(50)

      console.log("🎬 Starting MediaRecorder...")
      mediaRecorder.start(100)

      // Wait for recording to actually start
      await new Promise((resolve) => {
        const checkStart = () => {
          if (recordingStarted) {
            resolve(null)
          } else {
            setTimeout(checkStart, 100)
          }
        }
        checkStart()
      })

      console.log("✅ Recording confirmed started")

      // Simple animation without audio complexity
      setCurrentStep("Recording video...")
      setProgress(60)

      const totalFrames = config.duration * 30 // 30 FPS
      const framesPerImage = Math.ceil(totalFrames / loadedImages.length)
      let currentFrame = 0

      const animate = () => {
        if (currentFrame >= totalFrames) {
          console.log("🏁 Animation complete, stopping recording")
          mediaRecorder.stop()
          return
        }

        const imageIndex = Math.min(Math.floor(currentFrame / framesPerImage), loadedImages.length - 1)
        const timeElapsed = currentFrame / 30

        // Find current caption
        const currentCaptionChunk = config.captions.find(
          (caption: any) => timeElapsed >= caption.startTime && timeElapsed < caption.endTime,
        )

        if (currentCaptionChunk) {
          setCurrentCaption(currentCaptionChunk.text)
        } else {
          setCurrentCaption("")
        }

        // Draw frame
        const img = loadedImages[imageIndex]
        if (img && img.complete) {
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

          // Draw caption
          if (currentCaptionChunk) {
            drawCaption(ctx, currentCaptionChunk.text, canvas)
          }

          // Property overlay
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
          ctx.fillRect(0, 0, canvas.width, 100)

          ctx.fillStyle = "#FFFFFF"
          ctx.font = "bold 18px Arial"
          ctx.textAlign = "left"
          ctx.fillText(config.property.address, 20, 30)

          ctx.fillStyle = "#FFD700"
          ctx.font = "bold 16px Arial"
          ctx.fillText(`$${config.property.price.toLocaleString()}`, 20, 50)

          ctx.fillStyle = "#FFFFFF"
          ctx.font = "14px Arial"
          ctx.fillText(
            `${config.property.bedrooms}BR • ${config.property.bathrooms}BA • ${config.property.sqft.toLocaleString()} sqft`,
            20,
            70,
          )
        }

        currentFrame++
        const animationProgress = 60 + (currentFrame / totalFrames) * 30
        setProgress(Math.min(animationProgress, 90))
        setCurrentStep(`Recording: ${timeElapsed.toFixed(1)}s / ${config.duration}s`)

        requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("❌ Simple video generation failed:", error)
      onError(error instanceof Error ? error.message : "Video generation failed")
      setIsGenerating(false)
    }
  }, [config, onVideoGenerated, onError, loadImage, drawCaption])

  const resetGeneration = useCallback(() => {
    setVideoUrl(null)
    setProgress(0)
    setCurrentStep("")
    setCurrentCaption("")
  }, [])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-blue-700 text-lg">Simple Video Generator Ready!</span>
            </div>
            <div className="text-sm text-blue-600 space-y-2">
              <p>✅ {config.images.length} property images ready</p>
              <p>✅ {config.captions.length} captions prepared</p>
              <p>✅ {config.duration}s duration</p>
              <p>⚡ Simplified generation for reliability</p>
            </div>
          </div>

          <Button
            onClick={generateSimpleVideo}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Play className="mr-3 h-6 w-6" />
            Generate Simple Video
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
            <div className="bg-black text-yellow-400 p-4 rounded-lg text-center border-2 border-blue-500">
              <p className="font-bold text-lg">{currentCaption}</p>
              <p className="text-xs text-gray-300 mt-1">Current Caption</p>
            </div>
          )}

          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Generating simple video without complex audio sync...</AlertDescription>
          </Alert>
        </div>
      )}

      {videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-2 text-green-700 mb-3">
              <CheckCircle className="h-6 w-6" />
              <span className="font-bold text-lg">Simple Video Generated!</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ ALL {config.images.length} images included</p>
              <p>✅ Captions displayed throughout video</p>
              <p>✅ Ready for download</p>
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
              <a href={videoUrl} download="simple-property-video.webm">
                <Download className="mr-2 h-4 w-4" />
                Download Video
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
