"use client"

import { useState, useRef, type ChangeEvent } from "react"
import { Loader2, AlertCircle, XCircle, Wand2, Play, Download, RotateCcw, CheckCircle, UploadCloud } from "lucide-react"
import imageCompression from "browser-image-compression"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface UploadedImage {
  id: string
  file: File
  previewUrl: string
  blobUrl?: string
  status: "pending" | "compressing" | "uploading" | "success" | "error"
  error?: string
}

interface Caption {
  text: string
  startTime: number
  endTime: number
}

const MAX_IMAGES = 30

function VideoGenerator() {
  const [address, setAddress] = useState("")
  const [price, setPrice] = useState("")
  const [bedrooms, setBedrooms] = useState("")
  const [bathrooms, setBathrooms] = useState("")
  const [sqft, setSqft] = useState("")
  const [propertyDescription, setPropertyDescription] = useState("")
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [generatedScript, setGeneratedScript] = useState("")
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isVideoGenerated, setIsVideoGenerated] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const updateImageStatus = (id: string, status: UploadedImage["status"], data?: Partial<UploadedImage>) => {
    setUploadedImages((prev) => prev.map((img) => (img.id === id ? { ...img, status, ...data } : img)))
  }

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_IMAGES - uploadedImages.length)
    if (files.length === 0) return

    const newImages: UploadedImage[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
    }))

    setUploadedImages((prev) => [...prev, ...newImages])

    // Process images sequentially to avoid overwhelming the server
    for (const image of newImages) {
      try {
        // Step 1: Compress image to prevent 413 errors
        updateImageStatus(image.id, "compressing")
        const compressedFile = await imageCompression(image.file, {
          maxSizeMB: 2,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: "image/jpeg",
        })

        // Step 2: Upload compressed image using FormData
        updateImageStatus(image.id, "uploading")
        const formData = new FormData()
        formData.append("file", compressedFile)

        const response = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        })

        const result = await response.json()
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Upload failed")
        }

        updateImageStatus(image.id, "success", { blobUrl: result.url })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        updateImageStatus(image.id, "error", { error: errorMessage })
      }
    }
    e.target.value = "" // Allow re-uploading
  }

  const removeImage = (id: string) => {
    setUploadedImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id)
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl)
      }
      return prev.filter((img) => img.id !== id)
    })
  }

  const generateAIScript = async () => {
    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      setError("Please fill in all property details first.")
      return
    }

    setIsGeneratingScript(true)
    setError(null)

    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          price,
          bedrooms,
          bathrooms,
          sqft,
          propertyDescription,
        }),
      })

      if (!response.ok) {
        throw new Error("Script generation failed")
      }

      const { script } = await response.json()
      setGeneratedScript(script)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate script.")
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const createFeatureCaptions = (duration: number): Caption[] => {
    const caps: Caption[] = []

    // Only show key features as captions, not entire voiceover
    if (bedrooms)
      caps.push({ text: `${bedrooms} ${Number(bedrooms) === 1 ? "BEDROOM" : "BEDROOMS"}`, startTime: 0, endTime: 0 })
    if (bathrooms)
      caps.push({
        text: `${bathrooms} ${Number(bathrooms) === 1 ? "BATHROOM" : "BATHROOMS"}`,
        startTime: 0,
        endTime: 0,
      })
    if (sqft) caps.push({ text: `${Number(sqft).toLocaleString()} SQ FT`, startTime: 0, endTime: 0 })
    if (price) caps.push({ text: `$${Number(price).toLocaleString()}`, startTime: 0, endTime: 0 })

    // Extract special features from description
    if (propertyDescription) {
      const features = propertyDescription.match(/detached shop|corner lot|pool|garage|fireplace|deck|patio/gi)
      if (features && features.length > 0) {
        caps.push({ text: features[0].toUpperCase(), startTime: 0, endTime: 0 })
      }
    }

    // Distribute captions evenly across the video duration
    const timePerCaption = duration / Math.max(caps.length, 1)
    return caps.map((cap, i) => ({
      ...cap,
      startTime: i * timePerCaption + 2, // Start after 2 seconds
      endTime: (i + 1) * timePerCaption + 1, // Show for reasonable duration
    }))
  }

  const triggerDownload = (url: string, filename: string) => {
    try {
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  const generateVideo = async () => {
    const successfulUploads = uploadedImages.filter((i) => i.status === "success" && i.blobUrl)
    if (successfulUploads.length === 0) {
      setError("Please upload at least one image successfully.")
      return
    }
    if (!generatedScript) {
      setError("Please generate the AI script first.")
      return
    }

    setIsGenerating(true)
    setError(null)
    setVideoUrl(null)
    setIsVideoGenerated(false)

    try {
      // Step 1: Generate audio with LOCKED Rachel voice
      setProgress(10)
      setProgressMessage("Generating Rachel's voice...")
      const audioResp = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: generatedScript }),
      })
      if (!audioResp.ok) throw new Error("Failed to generate audio with Rachel's voice.")

      const audioBlob = await audioResp.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const duration = Number(audioResp.headers.get("X-Audio-Duration")) || 30

      // Step 2: Create feature-only captions (not full transcript)
      setProgress(20)
      setProgressMessage("Creating feature captions...")
      const captions = createFeatureCaptions(duration)

      // Step 3: Load images with silent error handling
      setProgress(30)
      setProgressMessage("Loading images...")
      const imgs = await Promise.all(
        successfulUploads.map(
          (up) =>
            new Promise<HTMLImageElement | null>((resolve) => {
              const img = new Image()
              img.crossOrigin = "anonymous"
              img.onload = () => resolve(img)
              img.onerror = () => resolve(null) // Silently fail and continue
              img.src = up.blobUrl!
            }),
        ),
      ).then((results) => results.filter((img): img is HTMLImageElement => img !== null))

      if (imgs.length === 0) throw new Error("No images could be loaded.")

      // Step 4: Setup canvas for 9:16 TikTok aspect ratio
      setProgress(40)
      setProgressMessage("Preparing video canvas...")
      const canvas = canvasRef.current!
      const ctx = canvas.getContext("2d")!
      canvas.width = 1080
      canvas.height = 1920

      const audio = audioRef.current!
      audio.src = audioUrl
      audio.muted = true

      // Step 5: Setup recording with audio sync
      const stream = canvas.captureStream(30) // 30 FPS
      let audioContext: AudioContext | null = null

      try {
        audioContext = new AudioContext()
        const source = audioContext.createMediaElementSource(audio)
        const dest = audioContext.createMediaStreamDestination()
        source.connect(dest)
        dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track))
      } catch (audioError) {
        console.error("Audio context setup failed:", audioError)
        // Continue without audio sync if it fails
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
      })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)

      recorder.start()
      audio.muted = false
      await audio.play()

      // Step 6: Render video frames with feature captions
      setProgress(50)
      setProgressMessage("Rendering video frames...")
      const timePerImage = duration / imgs.length
      let frameCount = 0
      const totalFrames = duration * 30

      const animate = () => {
        if (audio.paused || audio.ended) {
          recorder.stop()
          return
        }

        const elapsed = audio.currentTime
        const currentImageIndex = Math.min(Math.floor(elapsed / timePerImage), imgs.length - 1)
        const img = imgs[currentImageIndex]

        // Clear canvas
        ctx.fillStyle = "#000000"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw image with proper aspect ratio
        const imgAspect = img.width / img.height
        const canvasAspect = canvas.width / canvas.height

        let drawWidth, drawHeight, drawX, drawY

        if (imgAspect > canvasAspect) {
          // Image is wider - fit height
          drawHeight = canvas.height
          drawWidth = drawHeight * imgAspect
          drawX = (canvas.width - drawWidth) / 2
          drawY = 0
        } else {
          // Image is taller - fit width
          drawWidth = canvas.width
          drawHeight = drawWidth / imgAspect
          drawX = 0
          drawY = (canvas.height - drawHeight) / 2
        }

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

        // Draw feature captions only (bright yellow with black outline)
        captions.forEach((cap) => {
          if (elapsed >= cap.startTime && elapsed <= cap.endTime) {
            ctx.font = "bold 82px Arial"
            ctx.textAlign = "center"
            ctx.fillStyle = "#FFD700" // Bright yellow
            ctx.strokeStyle = "#000000" // Black outline
            ctx.lineWidth = 8

            const y = canvas.height - 250 // Lower third positioning
            ctx.strokeText(cap.text, canvas.width / 2, y)
            ctx.fillText(cap.text, canvas.width / 2, y)
          }
        })

        setProgress(50 + (frameCount / totalFrames) * 30)
        frameCount++
        requestAnimationFrame(animate)
      }
      animate()

      // Step 7: Process recording and convert to MP4
      recorder.onstop = async () => {
        if (audioContext) {
          try {
            await audioContext.close()
          } catch (error) {
            console.error("Error closing audio context:", error)
          }
        }

        const webmBlob = new Blob(chunks, { type: "video/webm" })

        setProgress(80)
        setProgressMessage("Uploading for final processing...")

        // Upload WebM using FormData
        const formData = new FormData()
        formData.append("file", webmBlob, "video.webm")

        const webmUploadResponse = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        })

        if (!webmUploadResponse.ok) {
          throw new Error("Failed to upload video for processing")
        }

        const { url: webmUrl } = await webmUploadResponse.json()

        setProgress(90)
        setProgressMessage("Converting to MP4...")
        const mp4Response = await fetch("/api/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ webmUrl }),
        })

        if (!mp4Response.ok) {
          throw new Error("Failed to process video")
        }

        const { mp4Url } = await mp4Response.json()
        if (!mp4Url) throw new Error("MP4 conversion failed.")

        setVideoUrl(mp4Url)
        triggerDownload(mp4Url, "snapsold-video.mp4")
        setProgress(100)
        setProgressMessage("Video generated successfully!")
        setIsVideoGenerated(true)
        setIsGenerating(false)
      }
    } catch (err) {
      console.error("Video generation error:", err)
      setError(err instanceof Error ? err.message : "Video generation failed.")
      setIsGenerating(false)
      setProgress(0)
      setProgressMessage("")
    }
  }

  const resetForNewVideo = () => {
    setVideoUrl(null)
    setIsVideoGenerated(false)
    setProgress(0)
    setProgressMessage("")
    setError(null)
  }

  const successfulUploadCount = uploadedImages.filter((i) => i.status === "success").length

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
      <canvas ref={canvasRef} className="hidden" />
      <audio ref={audioRef} className="hidden" />

      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            ✨ SnapSold ✨
          </h1>
          <p className="text-lg text-gray-600">AI-Powered Real Estate Videos</p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6">
            {/* Property Details Form */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="addr">Property Address</Label>
                <Input
                  id="addr"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isGenerating}
                  placeholder="123 Main St, City, State 12345"
                />
              </div>
              <div>
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={isGenerating}
                  placeholder="350000"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="br">Bedrooms</Label>
                <Input
                  id="br"
                  type="number"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  disabled={isGenerating}
                  placeholder="3"
                />
              </div>
              <div>
                <Label htmlFor="ba">Bathrooms</Label>
                <Input
                  id="ba"
                  type="number"
                  step="0.5"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  disabled={isGenerating}
                  placeholder="2.5"
                />
              </div>
              <div>
                <Label htmlFor="sqft">Square Feet</Label>
                <Input
                  id="sqft"
                  type="number"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  disabled={isGenerating}
                  placeholder="1800"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="desc">Property Description & Features</Label>
              <Textarea
                id="desc"
                value={propertyDescription}
                onChange={(e) => setPropertyDescription(e.target.value)}
                disabled={isGenerating}
                placeholder="Describe special features like detached shop, corner lot, pool, etc..."
                rows={3}
              />
            </div>

            {/* Image Upload Section */}
            <div className="space-y-3">
              <Label>Upload Property Photos (up to {MAX_IMAGES})</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500"
                >
                  <span>Click to upload photos</span>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleImageUpload}
                    disabled={isGenerating || uploadedImages.length >= MAX_IMAGES}
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  JPG, PNG, WebP up to 10MB each • Auto-compressed for optimal upload
                </p>
              </div>

              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="relative aspect-square group">
                      <img
                        src={img.previewUrl || "/placeholder.svg"}
                        alt={img.file.name}
                        className="h-full w-full object-cover rounded-lg border-2 border-gray-200"
                      />

                      {/* Status Overlay */}
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        {img.status === "compressing" && (
                          <div className="text-center">
                            <Loader2 className="h-6 w-6 animate-spin text-white mx-auto" />
                            <p className="text-xs text-white mt-1">Compressing...</p>
                          </div>
                        )}
                        {img.status === "uploading" && (
                          <div className="text-center">
                            <Loader2 className="h-6 w-6 animate-spin text-white mx-auto" />
                            <p className="text-xs text-white mt-1">Uploading...</p>
                          </div>
                        )}
                        {img.status === "success" && <CheckCircle className="h-8 w-8 text-green-400" />}
                        {img.status === "error" && (
                          <div className="text-center">
                            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
                            <p className="text-xs text-white mt-1" title={img.error}>
                              Failed
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={isGenerating}
                      >
                        <XCircle className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Script Generation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="script">AI-Generated Script</Label>
                <Button
                  onClick={generateAIScript}
                  disabled={isGeneratingScript || isGenerating}
                  variant="outline"
                  size="sm"
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate Script
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                id="script"
                value={generatedScript}
                onChange={(e) => setGeneratedScript(e.target.value)}
                rows={4}
                disabled={isGenerating}
                placeholder="Click 'Generate Script' to create an engaging TikTok-style script with natural number pronunciation..."
              />
            </div>

            {/* Progress Bar */}
            {isGenerating && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-center text-sm text-gray-600">{progressMessage}</p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="flex-1">{error}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setError(null)}
                  className="ml-2 h-6 w-6 hover:bg-red-100"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Generate Video Button */}
            {!isVideoGenerated ? (
              <Button
                onClick={generateVideo}
                disabled={isGenerating || successfulUploadCount === 0 || !generatedScript}
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 shadow-lg"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Video...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Generate Video with Rachel's Voice
                  </>
                )}
              </Button>
            ) : (
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-medium text-green-800">✅ Video generated and downloaded successfully!</p>
                  <p className="text-sm text-green-600 mt-1">
                    MP4 format • 1080x1920 • Rachel's voice • Feature captions
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => videoUrl && triggerDownload(videoUrl, "snapsold-video.mp4")}
                    disabled={!videoUrl}
                    variant="outline"
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Again
                  </Button>
                  <Button onClick={resetForNewVideo} className="w-full">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Generate Another
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function Home() {
  return <VideoGenerator />
}
