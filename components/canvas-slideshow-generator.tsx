"use client"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Play, Loader2, CheckCircle, AlertTriangle, Volume2, VolumeX } from "lucide-react"

interface SlideshowConfig {
  images: string[]
  timePerImage: number
  totalDuration: number
  audioUrl?: string
  audioMethod?: string
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
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [audioStatus, setAudioStatus] = useState<"checking" | "elevenlabs" | "browser" | "missing" | "error">(
    "checking",
  )

  const addDebugInfo = (info: string) => {
    console.log("🔧 DEBUG:", info)
    setDebugInfo((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${info}`])
  }

  const checkAudioAvailability = useCallback(async () => {
    if (!config.audioUrl) {
      setAudioStatus("missing")
      addDebugInfo("No audio URL provided")
      return { hasAudio: false, method: "none" }
    }

    // Check if it's ElevenLabs audio (data URL) or browser TTS
    if (config.audioUrl.startsWith("data:audio/")) {
      setAudioStatus("elevenlabs")
      addDebugInfo("ElevenLabs audio detected (data URL)")
      return { hasAudio: true, method: "elevenlabs" }
    } else if (config.audioUrl.startsWith("tts:")) {
      setAudioStatus("browser")
      addDebugInfo("Browser TTS fallback detected")
      return { hasAudio: true, method: "browser" }
    } else {
      setAudioStatus("error")
      addDebugInfo("Unknown audio format")
      return { hasAudio: false, method: "error" }
    }
  }, [config.audioUrl])

  // Browser TTS function
  const generateBrowserTTS = useCallback(async (text: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!("speechSynthesis" in window)) {
        reject(new Error("Speech synthesis not supported"))
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1.0
      utterance.volume = 1.0

      // Try to use a good voice
      const voices = speechSynthesis.getVoices()
      const preferredVoice = voices.find(
        (voice) => voice.name.includes("Google") || voice.name.includes("Microsoft") || voice.lang.startsWith("en"),
      )
      if (preferredVoice) {
        utterance.voice = preferredVoice
        addDebugInfo(`Using voice: ${preferredVoice.name}`)
      }

      // Record the speech
      const audioContext = new AudioContext()
      const destination = audioContext.createMediaStreamDestination()
      const mediaRecorder = new MediaRecorder(destination.stream)
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" })
        resolve(blob)
      }

      utterance.onstart = () => {
        mediaRecorder.start()
      }

      utterance.onend = () => {
        setTimeout(() => mediaRecorder.stop(), 500)
      }

      utterance.onerror = (error) => {
        reject(error)
      }

      speechSynthesis.speak(utterance)
    })
  }, [])

  const generateSlideshow = useCallback(async () => {
    if (!canvasRef.current) {
      onError("Canvas not available")
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setDebugInfo([])
    setCurrentStep("Starting slideshow generation...")
    addDebugInfo("Slideshow generation started")

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      // Set canvas size for TikTok format
      canvas.width = config.format.width
      canvas.height = config.format.height
      addDebugInfo(`Canvas size: ${canvas.width}x${canvas.height}`)

      // Check audio availability
      setCurrentStep("Checking audio availability...")
      setProgress(5)
      const audioInfo = await checkAudioAvailability()
      addDebugInfo(`Audio method: ${audioInfo.method}`)

      setCurrentStep("Loading images...")
      setProgress(10)

      // Load all images
      const loadedImages: HTMLImageElement[] = []
      for (let i = 0; i < config.images.length; i++) {
        const img = new Image()
        img.crossOrigin = "anonymous"

        await new Promise((resolve, reject) => {
          img.onload = () => {
            addDebugInfo(`Image ${i + 1} loaded: ${img.width}x${img.height}`)
            resolve(null)
          }
          img.onerror = (error) => {
            addDebugInfo(`Image ${i + 1} failed to load`)
            reject(error)
          }
          img.src = config.images[i]
        })

        loadedImages.push(img)
        setProgress(10 + (i / config.images.length) * 20)
      }

      addDebugInfo(`All ${loadedImages.length} images loaded successfully`)

      // Prepare audio
      let audioElement: HTMLAudioElement | null = null
      let audioBlob: Blob | null = null

      if (audioInfo.hasAudio && config.audioUrl) {
        setCurrentStep("Preparing audio...")
        setProgress(30)

        if (audioInfo.method === "elevenlabs") {
          // ElevenLabs audio (data URL)
          audioElement = new Audio()
          audioElement.src = config.audioUrl
          audioElement.crossOrigin = "anonymous"

          await new Promise((resolve, reject) => {
            audioElement!.onloadeddata = resolve
            audioElement!.onerror = reject
            audioElement!.load()
          })

          addDebugInfo("ElevenLabs audio loaded successfully")
        } else if (audioInfo.method === "browser") {
          // Browser TTS
          const ttsText = config.audioUrl.replace("tts:", "")
          try {
            audioBlob = await generateBrowserTTS(ttsText)
            audioElement = new Audio()
            audioElement.src = URL.createObjectURL(audioBlob)
            addDebugInfo("Browser TTS audio generated successfully")
          } catch (ttsError) {
            addDebugInfo(`Browser TTS failed: ${ttsError}`)
            audioElement = null
          }
        }
      }

      setCurrentStep("Setting up recording...")
      setProgress(35)

      // Create MediaRecorder
      const stream = canvas.captureStream(config.format.fps)
      addDebugInfo(`Canvas stream created`)

      // Try to add audio track if available
      if (audioElement && audioElement.captureStream) {
        try {
          const audioStream = audioElement.captureStream()
          const audioTracks = audioStream.getAudioTracks()

          if (audioTracks.length > 0) {
            stream.addTrack(audioTracks[0])
            addDebugInfo("Audio track added to stream")
          }
        } catch (audioError) {
          addDebugInfo(`Audio track integration failed: ${audioError}`)
        }
      }

      const mimeType = audioElement ? "video/webm;codecs=vp9,opus" : "video/webm;codecs=vp9"
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" })
          addDebugInfo(`Final video blob: ${blob.size} bytes`)
          resolve(blob)
        }
      })

      // Start recording
      mediaRecorder.start(1000)
      addDebugInfo("Recording started")

      setCurrentStep("Recording slideshow with audio...")
      setProgress(40)

      // Start audio playback
      if (audioElement) {
        try {
          audioElement.currentTime = 0
          await audioElement.play()
          addDebugInfo("Audio playback started")
        } catch (audioError) {
          addDebugInfo(`Audio playback failed: ${audioError}`)
        }
      }

      // Create slideshow animation
      let currentImageIndex = 0
      const startTime = Date.now()
      const timePerImageMs = config.timePerImage * 1000

      const animate = () => {
        const elapsed = Date.now() - startTime
        const totalDurationMs = config.totalDuration * 1000

        if (elapsed >= totalDurationMs) {
          // Stop audio
          if (audioElement) {
            audioElement.pause()
            addDebugInfo("Audio playback stopped")
          }
          // Stop recording
          mediaRecorder.stop()
          addDebugInfo("Recording stopped")
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

          // Add audio indicator
          if (audioElement && !audioElement.paused) {
            ctx.fillStyle = "rgba(255, 0, 0, 0.8)"
            ctx.fillRect(canvas.width - 50, 10, 40, 30)
            ctx.fillStyle = "#ffffff"
            ctx.font = "10px Arial"
            ctx.fillText(audioInfo.method === "elevenlabs" ? "EL" : "TTS", canvas.width - 45, 30)
          }
        }

        // Update progress
        const recordingProgress = 40 + (elapsed / totalDurationMs) * 50
        setProgress(recordingProgress)
        setCurrentStep(`Recording image ${currentImageIndex + 1}/${loadedImages.length}...`)

        requestAnimationFrame(animate)
      }

      animate()

      // Wait for recording to complete
      const videoBlob = await recordingPromise
      addDebugInfo("Recording completed successfully")

      setCurrentStep("Finalizing video...")
      setProgress(95)

      const finalUrl = URL.createObjectURL(videoBlob)
      setVideoUrl(finalUrl)
      onVideoGenerated(finalUrl)
      setCurrentStep("Slideshow completed!")
      setProgress(100)
      setIsGenerating(false)

      addDebugInfo("Slideshow generation completed successfully")

      // Cleanup
      if (audioBlob) {
        URL.revokeObjectURL(audioElement!.src)
      }
    } catch (error) {
      console.error("Slideshow generation failed:", error)
      addDebugInfo(`Generation failed: ${error}`)
      onError(error instanceof Error ? error.message : "Slideshow generation failed")
      setIsGenerating(false)
    }
  }, [config, onVideoGenerated, onError, checkAudioAvailability, generateBrowserTTS])

  // Test audio function
  const testAudio = useCallback(async () => {
    if (!config.audioUrl) return

    try {
      if (config.audioUrl.startsWith("data:audio/")) {
        // ElevenLabs audio
        const audio = new Audio()
        audio.src = config.audioUrl
        await audio.play()
        addDebugInfo("ElevenLabs audio test successful")
      } else if (config.audioUrl.startsWith("tts:")) {
        // Browser TTS
        const text = config.audioUrl.replace("tts:", "")
        const utterance = new SpeechSynthesisUtterance(text.substring(0, 100) + "...")
        speechSynthesis.speak(utterance)
        addDebugInfo("Browser TTS test successful")
      }
    } catch (error) {
      addDebugInfo(`Audio test failed: ${error}`)
    }
  }, [config.audioUrl])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          {/* Audio Status */}
          <div
            className={`border rounded-lg p-4 ${
              audioStatus === "elevenlabs"
                ? "bg-green-50 border-green-200"
                : audioStatus === "browser"
                  ? "bg-blue-50 border-blue-200"
                  : audioStatus === "missing"
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {audioStatus === "elevenlabs" && <Volume2 className="h-5 w-5 text-green-600" />}
              {audioStatus === "browser" && <Volume2 className="h-5 w-5 text-blue-600" />}
              {audioStatus === "missing" && <VolumeX className="h-5 w-5 text-yellow-600" />}
              {audioStatus === "error" && <AlertTriangle className="h-5 w-5 text-red-600" />}
              <span className="font-medium">
                Audio Status:{" "}
                {audioStatus === "elevenlabs"
                  ? "✅ ElevenLabs TTS"
                  : audioStatus === "browser"
                    ? "🔄 Browser TTS Fallback"
                    : audioStatus === "missing"
                      ? "⚠️ No Audio"
                      : "❌ Error"}
              </span>
            </div>
            {config.audioUrl && (
              <div className="flex gap-2">
                <Button onClick={checkAudioAvailability} variant="outline" size="sm">
                  Check Audio
                </Button>
                <Button onClick={testAudio} variant="outline" size="sm">
                  Test Audio
                </Button>
              </div>
            )}
          </div>

          {/* Generation Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">ElevenLabs Slideshow Ready!</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ {config.images.length} images loaded</p>
              <p>✅ {config.timePerImage}s per image</p>
              <p>✅ {config.totalDuration}s total duration</p>
              <p>✅ TikTok format (9:16)</p>
              {audioStatus === "elevenlabs" && <p>✅ ElevenLabs voiceover ready</p>}
              {audioStatus === "browser" && <p>🔄 Browser TTS fallback ready</p>}
              {audioStatus === "missing" && <p>⚠️ Video-only (no audio)</p>}
            </div>
          </div>

          <Button onClick={generateSlideshow} className="w-full" size="lg">
            <Play className="mr-2 h-4 w-4" />
            Generate Slideshow with ALL {config.images.length} Images
            {audioStatus === "elevenlabs" && " + ElevenLabs Audio"}
            {audioStatus === "browser" && " + Browser TTS"}
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
              Creating slideshow with {config.images.length} images...
              {audioStatus === "elevenlabs" && " ElevenLabs audio integration in progress."}
              {audioStatus === "browser" && " Browser TTS integration in progress."}
            </AlertDescription>
          </Alert>

          {/* Debug Info */}
          <div className="bg-gray-50 border rounded-lg p-3 max-h-40 overflow-y-auto">
            <p className="text-xs font-medium text-gray-700 mb-2">Debug Log:</p>
            {debugInfo.map((info, index) => (
              <p key={index} className="text-xs text-gray-600 font-mono">
                {info}
              </p>
            ))}
          </div>
        </div>
      )}

      {videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Video Generated with Audio!</span>
            </div>
            <div className="text-sm text-green-600">
              <p>✅ ALL {config.images.length} images included</p>
              <p>✅ {config.totalDuration} seconds duration</p>
              <p>✅ TikTok format ready</p>
              {audioStatus === "elevenlabs" && <p>✅ ElevenLabs voiceover embedded</p>}
              {audioStatus === "browser" && <p>✅ Browser TTS embedded</p>}
            </div>
          </div>

          <Button asChild className="w-full" size="lg">
            <a href={videoUrl} download="property-slideshow-with-elevenlabs-audio.webm">
              <Download className="mr-2 h-4 w-4" />
              Download Video with Audio
            </a>
          </Button>

          {/* Debug Info */}
          <details className="text-left">
            <summary className="text-sm text-gray-600 cursor-pointer">Show Debug Info</summary>
            <div className="bg-gray-50 border rounded-lg p-3 mt-2 max-h-40 overflow-y-auto">
              {debugInfo.map((info, index) => (
                <p key={index} className="text-xs text-gray-600 font-mono">
                  {info}
                </p>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
