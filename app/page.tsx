"use client"

import { useState, useRef, type ChangeEvent } from "react"
import { Loader2, AlertCircle, XCircle, Wand2, Play, Download, RotateCcw, CheckCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface UploadedImage {
  file: File
  previewUrl: string
  blobUrl?: string
  id: string
  isUploading?: boolean
  uploadError?: string
  uploadSuccess?: boolean
  uploadProgress?: number
}

interface Caption {
  text: string
  startTime: number
  endTime: number
  type: "bedrooms" | "bathrooms" | "sqft" | "price" | "location" | "feature"
}

const STREET_ABBREVIATIONS: Record<string, string> = {
  Dr: "Drive",
  dr: "Drive",
  ST: "Street",
  St: "Street",
  st: "Street",
  Ave: "Avenue",
  ave: "Avenue",
  AVE: "Avenue",
  Blvd: "Boulevard",
  blvd: "Boulevard",
  Rd: "Road",
  rd: "Road",
  Ln: "Lane",
  ln: "Lane",
  Ct: "Court",
  ct: "Court",
  Cir: "Circle",
  cir: "Circle",
  Pkwy: "Parkway",
  pkwy: "Parkway",
}

function expandStreetAbbreviations(address: string) {
  return address
    .split(" ")
    .map((word) => STREET_ABBREVIATIONS[word] ?? word)
    .join(" ")
}

const MAX_IMAGES = 30
const MAX_FILE_SIZE_MB = 10
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

function VideoGenerator() {
  // LOCKED FORM STATE - NO LAYOUT CHANGES ALLOWED
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
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isVideoGenerated, setIsVideoGenerated] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // SILENT ERROR HANDLING - NO USER-FACING ERROR LOGS
  const safeLoadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => resolve(img)
      img.onerror = () => {
        // SILENT CSP ERROR HANDLING - CREATE PLACEHOLDER
        const canvas = document.createElement("canvas")
        canvas.width = 800
        canvas.height = 600
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#f0f0f0"
        ctx.fillRect(0, 0, 800, 600)
        ctx.fillStyle = "#666"
        ctx.font = "24px Arial"
        ctx.textAlign = "center"
        ctx.fillText("Image Preview Unavailable", 400, 300)

        const placeholderImg = new Image()
        placeholderImg.src = canvas.toDataURL()
        placeholderImg.onload = () => resolve(placeholderImg)
      }

      img.src = src
    })
  }

  // Client-side compression to max 1920px longest edge, JPEG 0.85
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions - max 1920px longest edge
        const maxSize = 1920
        let { width, height } = img

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress to JPEG 0.85 quality
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            } else {
              resolve(file) // Fallback to original
            }
          },
          "image/jpeg",
          0.85,
        )
      }

      img.onerror = () => resolve(file) // SILENT FALLBACK

      img.src = URL.createObjectURL(file)
    })
  }

  // Sequential upload with per-image progress
  const uploadSingleImage = async (file: File, id: string): Promise<void> => {
    try {
      // Update progress to show compression
      setUploadedImages((prev) => prev.map((img) => (img.id === id ? { ...img, uploadProgress: 10 } : img)))

      // Validate and compress file
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Unsupported format. Use JPG, PNG, or WebP only.`)
      }

      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        const sizeMB = Math.round((file.size / 1024 / 1024) * 10) / 10
        throw new Error(`File too large (${sizeMB}MB). Maximum is ${MAX_FILE_SIZE_MB}MB.`)
      }

      // Compress image before upload
      const compressedFile = await compressImage(file)

      // Update progress to show upload starting
      setUploadedImages((prev) => prev.map((img) => (img.id === id ? { ...img, uploadProgress: 30 } : img)))

      const formData = new FormData()
      formData.append("file", compressedFile)

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Upload failed")
      }

      // Update image state with success
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? {
                ...img,
                blobUrl: result.url,
                isUploading: false,
                uploadSuccess: true,
                uploadError: undefined,
                uploadProgress: 100,
              }
            : img,
        ),
      )
    } catch (err) {
      // Update image state with error - don't block other uploads
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? {
                ...img,
                isUploading: false,
                uploadError: err instanceof Error ? err.message : "Upload failed",
                uploadSuccess: false,
                uploadProgress: 0,
              }
            : img,
        ),
      )
    }
  }

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const freeSlots = MAX_IMAGES - uploadedImages.length
    const filesToProcess = files.slice(0, freeSlots)

    if (files.length > freeSlots) {
      setError(`Only ${freeSlots} more images can be uploaded (${MAX_IMAGES} max total)`)
      setTimeout(() => setError(null), 5000)
    }

    // Add files to state immediately for UI feedback
    const newImages: UploadedImage[] = filesToProcess.map((file, idx) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      id: `img-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 8)}`,
      isUploading: true,
      uploadSuccess: false,
      uploadProgress: 0,
    }))

    setUploadedImages((prev) => [...prev, ...newImages])

    // Upload sequentially to avoid overwhelming the server
    for (const img of newImages) {
      await uploadSingleImage(img.file, img.id)
      // Small delay between uploads
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Clear the input to allow re-uploading same files
    e.target.value = ""
  }

  const removeImage = (id: string) => {
    setUploadedImages((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target) {
        try {
          URL.revokeObjectURL(target.previewUrl)
        } catch (e) {
          // SILENT CLEANUP FAILURE
        }
      }
      return prev.filter((i) => i.id !== id)
    })
  }

  const generateAIScript = async () => {
    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      setError("Fill in all property details first.")
      return
    }
    setIsGeneratingScript(true)
    setError(null)

    try {
      const resp = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: expandStreetAbbreviations(address),
          price: Number(price),
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          sqft: Number(sqft),
          propertyDescription,
          imageCount: uploadedImages.filter((img) => img.uploadSuccess).length,
        }),
      })

      if (!resp.ok) throw new Error(`Script generation failed`)

      const { script } = await resp.json()
      setGeneratedScript(script)
    } catch (err) {
      setError("Script generation failed. Please try again.")
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // FEATURE-ONLY CAPTIONS (NOT FULL SCRIPT)
  const createFeatureCaptions = (duration: number): Caption[] => {
    const caps: Caption[] = []

    const br = Number(bedrooms)
    const ba = Number(bathrooms)
    const sqftNum = Number(sqft)
    const priceNum = Number(price)

    // ONLY KEY PROPERTY FEATURES - NO FULL SCRIPT CAPTIONING
    if (br)
      caps.push({
        text: `${br} ${br === 1 ? "BEDROOM" : "BEDROOMS"}`,
        startTime: duration * 0.15,
        endTime: duration * 0.15 + 2.5,
        type: "bedrooms",
      })
    if (ba)
      caps.push({
        text: `${ba === Math.floor(ba) ? ba : ba.toString().replace(".5", " ½")} ${ba === 1 ? "BATHROOM" : "BATHROOMS"}`,
        startTime: duration * 0.25,
        endTime: duration * 0.25 + 2.5,
        type: "bathrooms",
      })
    if (sqftNum)
      caps.push({
        text: `${sqftNum.toLocaleString()} SQ FT`,
        startTime: duration * 0.35,
        endTime: duration * 0.35 + 2.5,
        type: "sqft",
      })
    if (priceNum)
      caps.push({
        text: `$${priceNum.toLocaleString()}`,
        startTime: duration * 0.65,
        endTime: duration * 0.65 + 3,
        type: "price",
      })

    const loc = expandStreetAbbreviations(address).split(",")[0].trim().toUpperCase()
    if (loc)
      caps.push({
        text: loc,
        startTime: duration * 0.75,
        endTime: duration * 0.75 + 2.5,
        type: "location",
      })

    // Extract unique amenities from description (detached shop, corner lot, etc.)
    if (propertyDescription) {
      const uniqueFeatures = propertyDescription
        .toLowerCase()
        .match(/(detached shop|corner lot|pool|garage|fireplace|deck|patio|basement|attic|walk-in closet)/g)

      if (uniqueFeatures && uniqueFeatures.length > 0) {
        const feature = uniqueFeatures[0].toUpperCase()
        caps.push({
          text: feature,
          startTime: duration * 0.45,
          endTime: duration * 0.45 + 2,
          type: "feature",
        })
      }
    }

    return caps
  }

  // AUTO-DOWNLOAD FUNCTION - NO PREVIEW
  const triggerDownload = (url: string, filename: string) => {
    try {
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      // SILENT DOWNLOAD FAILURE
    }
  }

  // SINGLE "GENERATE VIDEO" BUTTON - DOES EVERYTHING
  const generateVideo = async () => {
    const successfulUploads = uploadedImages.filter((i) => i.blobUrl && i.uploadSuccess)

    if (successfulUploads.length === 0) {
      setError("Upload at least one image successfully.")
      return
    }
    if (!generatedScript) {
      setError("Generate the AI script first.")
      return
    }

    setIsGenerating(true)
    setProgress(5)
    setError(null)
    setVideoUrl(null)
    setIsVideoGenerated(false)

    try {
      // Step 1: Generate audio with LOCKED Rachel voice (NO FALLBACKS)
      const audioResp = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: generatedScript }),
      })

      if (!audioResp.ok) {
        throw new Error("Rachel voice generation failed")
      }

      const audioBlob = await audioResp.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const duration = Number(audioResp.headers.get("X-Audio-Duration")) || 30

      setProgress(20)

      // Step 2: Create feature-only captions
      const captions = createFeatureCaptions(duration)
      setProgress(25)

      // Step 3: Load images with SILENT error handling
      const imgs = []
      for (const up of successfulUploads) {
        try {
          const img = await safeLoadImage(up.blobUrl!)
          imgs.push(img)
        } catch (e) {
          // SILENT IMAGE LOAD FAILURE - SKIP AND CONTINUE
        }
      }

      if (imgs.length === 0) {
        throw new Error("No images could be loaded")
      }

      setProgress(35)

      // Step 4: Setup canvas for 1080x1920 (vertical TikTok format)
      const canvas = canvasRef.current!
      const ctx = canvas.getContext("2d")!
      canvas.width = 1080
      canvas.height = 1920

      const audio = audioRef.current!
      audio.src = audioUrl
      audio.muted = true

      // SILENT audio setup
      try {
        await audio.play()
        audio.pause()
        audio.currentTime = 0
      } catch (e) {
        // SILENT AUDIO SETUP FAILURE
      }

      // Step 5: Setup recording with audio sync
      let ac: AudioContext | null = null
      const stream = canvas.captureStream(30) // 30 FPS

      try {
        ac = new AudioContext()
        const srcNode = ac.createMediaElementSource(audio)
        const dest = ac.createMediaStreamDestination()
        srcNode.connect(dest)
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
      } catch (e) {
        // SILENT AUDIO CONTEXT FAILURE - CONTINUE WITHOUT AUDIO
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 5000000, // 5 Mbps for high quality
      })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)

      recorder.start(100)
      audio.muted = false

      try {
        await audio.play()
      } catch (e) {
        // SILENT AUDIO PLAY FAILURE
      }

      const start = Date.now()
      const durationMs = duration * 1000
      const perImg = durationMs / imgs.length

      // Step 6: Render video with captions
      const animate = () => {
        const elapsed = Date.now() - start
        const sec = elapsed / 1000

        if (elapsed >= durationMs) {
          audio.pause()
          recorder.stop()
          return
        }

        const idx = Math.min(Math.floor(elapsed / perImg), imgs.length - 1)
        const img = imgs[idx]

        try {
          // Draw image to fill canvas
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
        } catch (e) {
          // SILENT CANVAS DRAW FAILURE
        }

        // Draw FEATURE-ONLY CAPTIONS (Bright Yellow #FFD700, lower-third safe zone)
        captions.forEach((c) => {
          if (sec >= c.startTime && sec <= c.endTime) {
            ctx.font = "bold 72px Arial"
            ctx.textAlign = "center"
            ctx.lineWidth = 12
            ctx.strokeStyle = "#000000" // Black outline
            ctx.fillStyle = "#FFD700" // Bright Yellow

            const y = canvas.height - 300 // Lower third positioning
            try {
              ctx.strokeText(c.text, canvas.width / 2, y)
              ctx.fillText(c.text, canvas.width / 2, y)
            } catch (e) {
              // SILENT CAPTION DRAW FAILURE
            }
          }
        })

        setProgress(35 + (sec / duration) * 40)
        requestAnimationFrame(animate)
      }
      animate()

      // Step 7: Process recording and convert to MP4
      recorder.onstop = async () => {
        if (ac) {
          try {
            await ac.close()
          } catch (e) {
            // SILENT AUDIO CONTEXT CLOSE FAILURE
          }
        }

        const blob = new Blob(chunks, { type: "video/webm" })
        setProgress(80)

        // Upload WebM for conversion
        const fd = new FormData()
        fd.append("file", blob, "video.webm")
        const up = await fetch("/api/upload-image", { method: "POST", body: fd })
        if (!up.ok) throw new Error("Upload failed")
        const { url: webmUrl } = await up.json()

        setProgress(90)

        // Convert to MP4 H.264/AAC (REQUIRED FORMAT - 1080x1920, 30fps)
        try {
          const conv = await fetch("/api/convert-to-mp4", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ webmUrl }),
          })

          if (conv.ok) {
            const { mp4Url } = await conv.json()
            setVideoUrl(mp4Url)

            // AUTO-DOWNLOAD MP4 - NO PREVIEW
            triggerDownload(mp4Url, "property-video.mp4")
          } else {
            throw new Error("MP4 conversion failed")
          }
        } catch (convError) {
          throw new Error("MP4 conversion failed")
        }

        setProgress(100)
        setIsGenerating(false)
        setIsVideoGenerated(true)
      }
    } catch (err) {
      setError("Video generation failed. Please try again.")
      setIsGenerating(false)
    }
  }

  // RESET FOR NEW VIDEO
  const resetForNewVideo = () => {
    setVideoUrl(null)
    setIsVideoGenerated(false)
    setProgress(0)
    setError(null)
  }

  const uploaded = uploadedImages.filter((i) => i.uploadSuccess).length
  const uploading = uploadedImages.filter((i) => i.isUploading).length
  const failed = uploadedImages.filter((i) => i.uploadError).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
      {/* Hidden canvas / audio */}
      <canvas ref={canvasRef} className="hidden" />
      <audio ref={audioRef} className="hidden" />

      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
            ✨ SnapSold ✨
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">Create viral listing videos that sell homes fast</p>
        </div>

        {/* LOCKED PROPERTY FORM - NO LAYOUT CHANGES ALLOWED */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="addr">Property Address</Label>
                <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} disabled={isGenerating} />
              </div>
              <div>
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={isGenerating}
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
                />
              </div>
              <div>
                <Label htmlFor="sqft">Square Footage</Label>
                <Input
                  id="sqft"
                  type="number"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="desc">📝 Property Description & Key Features</Label>
              <Textarea
                id="desc"
                rows={3}
                value={propertyDescription}
                onChange={(e) => setPropertyDescription(e.target.value)}
                disabled={isGenerating}
                placeholder="Describe unique features like detached shop, corner lot, pool, etc..."
              />
            </div>

            <div className="space-y-2">
              <Label>Upload Property Images (Max {MAX_IMAGES})</Label>
              <Input
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleImageUpload}
                disabled={isGenerating}
              />
              <p className="text-sm text-gray-500">
                {uploaded} uploaded, {uploading} uploading, {failed} failed
                {uploadedImages.length > 0 && ` • Auto-compressed to max 1920px, JPG quality 85%`}
              </p>
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="relative">
                      <img
                        src={img.previewUrl || "/placeholder.svg"}
                        alt=""
                        className="h-20 w-full object-cover rounded border cursor-pointer"
                        onClick={() => !isGenerating && removeImage(img.id)}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = "/placeholder.svg?height=80&width=80&text=Preview+Error"
                        }}
                      />
                      {img.isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                          {img.uploadProgress && (
                            <span className="absolute bottom-1 left-1 text-xs text-white">{img.uploadProgress}%</span>
                          )}
                        </div>
                      )}
                      {img.uploadSuccess && (
                        <CheckCircle className="absolute top-1 right-1 h-4 w-4 text-green-600 bg-white rounded-full" />
                      )}
                      {img.uploadError && (
                        <AlertCircle
                          className="absolute top-1 right-1 h-4 w-4 text-red-600 bg-white rounded-full"
                          title={img.uploadError}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="generated-script">AI-Generated Script (~35s target)</Label>
                <Button
                  onClick={generateAIScript}
                  disabled={isGeneratingScript || isGenerating}
                  variant="outline"
                  size="sm"
                  className="h-8 bg-transparent"
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-1 h-3 w-3" />
                      Generate Script
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                id="generated-script"
                value={generatedScript}
                onChange={(e) => setGeneratedScript(e.target.value)}
                placeholder="Click 'Generate Script' to create a voiceover-ready script with natural number pronunciation..."
                className="min-h-[120px]"
                disabled={isGenerating}
              />
            </div>

            {/* PROGRESS BAR ONLY - NO ADDITIONAL TEXT */}
            {isGenerating && (
              <div>
                <Progress value={progress} />
                <p className="text-center text-sm mt-2">{Math.round(progress)}%</p>
              </div>
            )}

            {error && (
              <div className="flex items-center text-sm text-red-600">
                <AlertCircle className="h-4 w-4 mr-1" /> {error}
                <Button size="icon" variant="ghost" onClick={() => setError(null)} className="ml-auto h-6 w-6">
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* SINGLE "GENERATE VIDEO" BUTTON */}
            {!isVideoGenerated ? (
              <Button
                onClick={generateVideo}
                disabled={isGenerating || !generatedScript || uploaded === 0}
                className="w-full h-16 text-xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 shadow-lg"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Video...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" /> Generate Video
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="text-center text-green-600 font-medium">
                  ✅ Video generated and downloaded successfully!
                </div>

                {/* ONLY TWO BUTTONS AFTER GENERATION */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => videoUrl && triggerDownload(videoUrl, "property-video.mp4")}
                    disabled={!videoUrl}
                    variant="outline"
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" /> Download MP4 Again
                  </Button>

                  <Button onClick={resetForNewVideo} className="w-full">
                    <RotateCcw className="mr-2 h-4 w-4" /> Generate Another
                  </Button>
                </div>
              </div>
            )}

            {/* NO VIDEO PREVIEW - JUST FORMAT INFO */}
            {videoUrl && (
              <div className="text-center text-sm text-gray-500">
                Video format: MP4 (H.264/AAC) • 1080x1920 • 30fps • Rachel voice
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
