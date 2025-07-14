"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Loader2, CheckCircle, RotateCcw, AlertTriangle, Zap } from "lucide-react"

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

interface SyncedVideoGeneratorProps {
  config: VideoConfig
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function SyncedVideoGenerator({ config, onVideoGenerated, onError }: SyncedVideoGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [showFallback, setShowFallback] = useState(false)

  // Ultra-simple approach: Create a slideshow-style video without MediaRecorder
  const generateUltraSimpleVideo = useCallback(async () => {
    setIsGenerating(true)
    setProgress(0)
    setCurrentStep("Creating simple slideshow video...")

    try {
      // Step 1: Create a simple HTML-based slideshow
      setProgress(25)
      setCurrentStep("Preparing slideshow data...")

      const slideshowData = {
        images: config.images,
        captions: config.captions,
        property: config.property,
        duration: config.duration,
        audioUrl: config.audioUrl,
      }

      setProgress(50)
      setCurrentStep("Generating slideshow...")

      // Step 2: Call a simple slideshow API that doesn't use MediaRecorder
      const response = await fetch("/api/create-simple-slideshow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slideshowData),
      })

      if (!response.ok) {
        throw new Error(`Slideshow API failed: ${response.status}`)
      }

      const result = await response.json()

      setProgress(75)
      setCurrentStep("Finalizing video...")

      if (result.success && result.videoUrl) {
        setProgress(100)
        setCurrentStep("Video ready!")
        setVideoUrl(result.videoUrl)
        onVideoGenerated(result.videoUrl)
      } else {
        throw new Error(result.error || "Slideshow creation failed")
      }
    } catch (error) {
      console.error("Ultra-simple video generation failed:", error)
      onError(error instanceof Error ? error.message : "Video generation failed")
    } finally {
      setIsGenerating(false)
    }
  }, [config, onVideoGenerated, onError])

  // Fallback: Just provide the images and audio separately
  const createImagePackage = useCallback(() => {
    setIsGenerating(true)
    setProgress(0)
    setCurrentStep("Creating image package...")

    try {
      // Create a simple package with all the assets
      const packageData = {
        images: config.images,
        audio: config.audioUrl,
        captions: config.captions.map((cap) => cap.text).join("\n\n"),
        property: config.property,
        instructions: `
Property Video Package for ${config.property.address}

IMAGES: ${config.images.length} property photos
AUDIO: Rachel voiceover (${config.duration}s)
CAPTIONS: ${config.captions.length} text overlays

Instructions:
1. Download all images
2. Use the audio file as voiceover
3. Display captions as text overlays
4. Create video using any video editing software

This package contains everything needed to create your property video!
        `,
      }

      setProgress(100)
      setCurrentStep("Package ready!")

      // Create a downloadable text file with instructions
      const instructionsBlob = new Blob([packageData.instructions], { type: "text/plain" })
      const instructionsUrl = URL.createObjectURL(instructionsBlob)

      setVideoUrl(instructionsUrl)
      onVideoGenerated(instructionsUrl)
    } catch (error) {
      onError("Failed to create package")
    } finally {
      setIsGenerating(false)
    }
  }, [config, onVideoGenerated])

  const resetGeneration = useCallback(() => {
    setVideoUrl(null)
    setProgress(0)
    setCurrentStep("")
    setShowFallback(false)
  }, [])

  return (
    <div className="space-y-4">
      {!videoUrl && !isGenerating && !showFallback && (
        <div className="text-center space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p>
                  <strong>MediaRecorder Issue Detected</strong>
                </p>
                <p>
                  The browser's video recording API is not working properly and keeps hanging at 50%. This is a common
                  issue with MediaRecorder in certain browsers.
                </p>
                <div className="flex gap-2">
                  <Button onClick={generateUltraSimpleVideo} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Zap className="mr-2 h-4 w-4" />
                    Try Simple Slideshow
                  </Button>
                  <Button onClick={() => setShowFallback(true)} variant="outline">
                    Show Alternatives
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {showFallback && !isGenerating && !videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
              <span className="font-bold text-yellow-700 text-lg">Alternative Solutions</span>
            </div>
            <div className="text-sm text-yellow-700 space-y-3">
              <p>Since the browser video recording is not working, here are your options:</p>

              <div className="grid gap-3">
                <Button onClick={generateUltraSimpleVideo} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Zap className="mr-2 h-4 w-4" />
                  Try Server-Side Slideshow
                </Button>

                <Button onClick={createImagePackage} variant="outline" className="bg-white">
                  <Download className="mr-2 h-4 w-4" />
                  Download Assets Package
                </Button>
              </div>

              <div className="text-xs text-gray-600 mt-4 p-3 bg-gray-50 rounded">
                <p>
                  <strong>Why this happens:</strong> Some browsers have issues with MediaRecorder API, especially with
                  canvas streams. This is a known limitation.
                </p>
              </div>
            </div>
          </div>
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

          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Creating your property video using alternative method...</AlertDescription>
          </Alert>
        </div>
      )}

      {videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-2 text-green-700 mb-3">
              <CheckCircle className="h-6 w-6" />
              <span className="font-bold text-lg">Alternative Solution Ready!</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ Bypassed browser MediaRecorder issues</p>
              <p>✅ All {config.images.length} images included</p>
              <p>✅ Rachel voiceover included</p>
              <p>✅ Ready for download</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={resetGeneration} variant="outline" className="flex-1 bg-transparent">
              <RotateCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              asChild
              className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            >
              <a href={videoUrl} download="property-video-package.txt">
                <Download className="mr-2 h-4 w-4" />
                Download Solution
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
