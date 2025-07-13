"use client"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Play, Loader2, CheckCircle } from "lucide-react"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

interface SlideshowConfig {
  images: string[]
  timePerImage: number
  totalDuration: number
  audioUrl?: string
  format: {
    width: number
    height: number
    fps: number
  }
}

interface CanvasSlideshowGeneratorProps {
  config: SlideshowConfig
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function CanvasSlideshowGenerator({ config, onVideoGenerated, onError }: CanvasSlideshowGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  // Initialize FFmpeg
  const initFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current

    const ffmpeg = new FFmpeg()
    ffmpegRef.current = ffmpeg

    ffmpeg.on("log", ({ message }) => {
      console.log("FFmpeg:", message)
    })

    ffmpeg.on("progress", ({ progress: ffmpegProgress }) => {
      // Update progress during FFmpeg processing (80-95%)
      setProgress(80 + ffmpegProgress * 15)
    })

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    })

    return ffmpeg
  }, [])

  const generateSlideshow = useCallback(async () => {
    if (!canvasRef.current) {
      onError("Canvas not available")
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setCurrentStep("Initializing slideshow generation...")

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      // Set canvas size for TikTok format
      canvas.width = config.format.width
      canvas.height = config.format.height

      setCurrentStep("Loading images...")
      setProgress(10)

      // Load all images
      const loadedImages: HTMLImageElement[] = []
      for (let i = 0; i < config.images.length; i++) {
        const img = new Image()
        img.crossOrigin = "anonymous"

        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = config.images[i]
        })

        loadedImages.push(img)
        setProgress(10 + (i / config.images.length) * 20)
      }

      setCurrentStep("Recording video slideshow...")
      setProgress(30)

      // Create video stream from canvas (video only first)
      const stream = canvas.captureStream(config.format.fps)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      // Promise to handle recording completion
      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" })
          resolve(blob)
        }
      })

      // Start recording
      mediaRecorder.start()

      // Create slideshow animation
      let currentImageIndex = 0
      const startTime = Date.now()
      const timePerImageMs = config.timePerImage * 1000

      const animate = () => {
        const elapsed = Date.now() - startTime
        const totalDurationMs = config.totalDuration * 1000

        if (elapsed >= totalDurationMs) {
          // Slideshow complete
          mediaRecorder.stop()
          return
        }

        // Calculate which image to show
        const imageIndex = Math.floor(elapsed / timePerImageMs)
        if (imageIndex < loadedImages.length) {
          currentImageIndex = imageIndex
        }

        // Clear canvas
        ctx.fillStyle = "#000000"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw current image
        if (loadedImages[currentImageIndex]) {
          const img = loadedImages[currentImageIndex]

          // Calculate scaling to fit TikTok format
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const x = (canvas.width - scaledWidth) / 2
          const y = (canvas.height - scaledHeight) / 2

          ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

          // Add image counter
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
          ctx.fillRect(10, 10, 120, 30)
          ctx.fillStyle = "#ffffff"
          ctx.font = "16px Arial"
          ctx.fillText(`${currentImageIndex + 1}/${loadedImages.length}`, 20, 30)
        }

        // Update progress during recording (30-60%)
        const recordingProgress = 30 + (elapsed / totalDurationMs) * 30
        setProgress(recordingProgress)
        setCurrentStep(`Recording image ${currentImageIndex + 1}/${loadedImages.length}...`)

        requestAnimationFrame(animate)
      }

      animate()

      // Wait for recording to complete
      const videoBlob = await recordingPromise
      setCurrentStep("Video recorded successfully!")
      setProgress(60)

      // If no audio, just return the video
      if (!config.audioUrl) {
        const url = URL.createObjectURL(videoBlob)
        setVideoUrl(url)
        onVideoGenerated(url)
        setCurrentStep("Slideshow completed!")
        setProgress(100)
        setIsGenerating(false)
        return
      }

      // Combine video with audio using FFmpeg
      setCurrentStep("Initializing FFmpeg for audio combination...")
      setProgress(65)

      const ffmpeg = await initFFmpeg()

      setCurrentStep("Loading audio file...")
      setProgress(70)

      // Load audio file
      const audioResponse = await fetch(config.audioUrl)
      const audioBlob = await audioResponse.blob()

      setCurrentStep("Preparing files for combination...")
      setProgress(75)

      // Write files to FFmpeg filesystem
      await ffmpeg.writeFile("video.webm", await fetchFile(videoBlob))
      await ffmpeg.writeFile("audio.wav", await fetchFile(audioBlob))

      setCurrentStep("Combining video and audio...")
      setProgress(80)

      // Combine video and audio
      await ffmpeg.exec([
        "-i",
        "video.webm",
        "-i",
        "audio.wav",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        "-y",
        "output.mp4",
      ])

      setCurrentStep("Finalizing combined video...")
      setProgress(95)

      // Read the output file
      const outputData = await ffmpeg.readFile("output.mp4")
      const outputBlob = new Blob([outputData], { type: "video/mp4" })
      const finalUrl = URL.createObjectURL(outputBlob)

      setVideoUrl(finalUrl)
      onVideoGenerated(finalUrl)
      setCurrentStep("Slideshow with audio completed!")
      setProgress(100)
      setIsGenerating(false)

      console.log("✅ Video and audio combined successfully!")
    } catch (error) {
      console.error("Slideshow generation failed:", error)
      onError(error instanceof Error ? error.message : "Slideshow generation failed")
      setIsGenerating(false)
    }
  }, [config, onVideoGenerated, onError, initFFmpeg])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Advanced Slideshow Ready!</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ {config.images.length} images loaded</p>
              <p>✅ {config.timePerImage}s per image</p>
              <p>✅ {config.totalDuration}s total duration</p>
              <p>✅ TikTok format (9:16)</p>
              {config.audioUrl && <p>✅ AI voiceover will be automatically embedded</p>}
              <p>✅ FFmpeg-powered audio/video combination</p>
            </div>
          </div>

          <Button onClick={generateSlideshow} className="w-full" size="lg">
            <Play className="mr-2 h-4 w-4" />
            Generate Complete Video with ALL {config.images.length} Images
            {config.audioUrl && " + Audio"}
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
            <Progress value={progress} className="h-2" />
          </div>

          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              {progress < 60 && `Recording slideshow with ${config.images.length} images...`}
              {progress >= 60 && progress < 80 && "Preparing audio combination..."}
              {progress >= 80 && "Combining video and audio with FFmpeg..."}
              {config.audioUrl && " Audio will be automatically embedded in the final video."}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Complete Video Generated!</span>
            </div>
            <div className="text-sm text-green-600">
              <p>✅ ALL {config.images.length} images included</p>
              <p>✅ {config.totalDuration} seconds duration</p>
              <p>✅ TikTok format (9:16)</p>
              {config.audioUrl && <p>✅ AI voiceover embedded automatically</p>}
              <p>✅ Ready to upload to TikTok/Instagram!</p>
            </div>
          </div>

          <Button asChild className="w-full" size="lg">
            <a href={videoUrl} download="property-slideshow-with-audio.mp4">
              <Download className="mr-2 h-4 w-4" />
              Download Complete Video {config.audioUrl && "(with Audio)"}
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}
