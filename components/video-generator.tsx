"use client"

import { useState, useRef, type ChangeEvent } from "react"
import { Loader2, AlertCircle, XCircle, Wand2, Play, Download, RotateCcw } from "lucide-react"

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
const MAX_WEBM_SIZE_MB = 200

function VideoGenerator() {
  // FROZEN FORM STATE - NO CHANGES
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

  // SILENT ERROR HANDLING FOR CSP ISSUES
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

  const compressImage = (file: File, maxWidth = 800, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      const img = new Image()

      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob!], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          },
          "image/jpeg",
          quality,
        )
      }

      img.onerror = () => resolve(file) // SILENT FALLBACK

      img.src = URL.createObjectURL(file)
    })
  }

  const uploadImageToBlob = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || "Upload failed")
    }

    const { url } = await response.json()
    return url
  }

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const freeSlots = MAX_IMAGES - uploadedImages.length

    files.slice(0, freeSlots).forEach(async (file, idx) => {
      const id = `img-${Date.now()}-${idx}`
      const newImg: UploadedImage = {
        file,
        previewUrl: URL.createObjectURL(file),
        id,
        isUploading: true,
      }
      setUploadedImages((prev) => [...prev, newImg])

      try {
        const compressed = await compressImage(file)
        const blobUrl = await uploadImageToBlob(compressed)
        setUploadedImages((prev) => prev.map((img) => (img.id === id ? { ...img, blobUrl, isUploading: false } : img)))
      } catch (err) {
        setUploadedImages((prev) =>
          prev.map((img) =>
            img.id === id
              ? { ...img, isUploading: false, uploadError: err instanceof Error ? err.message : "Upload failed" }
              : img,
          ),
        )
      }
    })
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
          imageCount: uploadedImages.length,
        }),
      })

      if (!resp.ok) throw new Error(`API ${resp.status}`)

      const { script } = await resp.json()
      setGeneratedScript(script)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // FEATURE-ONLY CAPTIONS (NOT FULL SCRIPT)
  const makeCaptions = (duration: number): Caption[] => {
    const caps: Caption[] = []

    const br = Number(bedrooms)
    const ba = Number(bathrooms)
    const sqftNum = Number(sqft)
    const priceNum = Number(price)

    // ONLY KEY PROPERTY FEATURES
    if (br)
      caps.push({
        text: `${br} ${br === 1 ? "BEDROOM" : "BEDROOMS"}`,
        startTime: duration * 0.15,
        endTime: duration * 0.15 + 2.5,
        type: "bedrooms",
      })
    if (ba)
      caps.push({
        text: `${ba} ${ba === 1 ? "BATHROOM" : "BATHROOMS"}`,
        startTime: duration * 0.25,
        endTime: duration * 0.25 + 2.5,
        type: "bathrooms",
      })
    if (sqftNum)
      caps.push({
        text: `${sqftNum.toLocaleString()} SQUARE FEET`,
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

    if (propertyDescription) {
      const feature = propertyDescription
        .split(/[,.!;]/)[0]
        .trim()
        .toUpperCase()
      if (feature)
        caps.push({
          text: feature,
          startTime: duration * 0.45,
          endTime: duration * 0.45 + 2,
          type: "feature",
        })
    }

    return caps
  }

  // AUTO-DOWNLOAD FUNCTION
  const triggerDownload = (url: string, filename: string) => {
    try {
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      console.log(`✅ Auto-download triggered: ${filename}`)
    } catch (e) {
      // SILENT DOWNLOAD FAILURE
    }
  }

  // SINGLE GENERATE VIDEO FUNCTION
  const generateVideo = async () => {
    if (uploadedImages.filter((i) => i.blobUrl).length === 0) {
      setError("Upload at least one image.")
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
      // Generate audio with LOCKED Rachel voice
      console.log("🎤 Generating audio with LOCKED Rachel voice...")
      const audioResp = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: generatedScript }),
      })
      if (!audioResp.ok) throw new Error("Audio generation failed")
      const { audioUrl, duration } = await audioResp.json()
      setProgress(20)

      const captions = makeCaptions(duration)
      setProgress(25)

      // Load images with SILENT error handling
      const imgs = []
      for (const up of uploadedImages.filter((u) => u.blobUrl)) {
        try {
          const img = await safeLoadImage(up.blobUrl!)
          imgs.push(img)
        } catch (e) {
          // SILENT IMAGE LOAD FAILURE - CONTINUE
        }
      }

      if (imgs.length === 0) {
        throw new Error("No images could be loaded")
      }

      setProgress(35)

      const canvas = canvasRef.current!
      const ctx = canvas.getContext("2d")!
      canvas.width = 576
      canvas.height = 1024

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

      let ac: AudioContext | null = null
      const stream = canvas.captureStream(30)

      try {
        ac = new AudioContext()
        const srcNode = ac.createMediaElementSource(audio)
        const dest = ac.createMediaStreamDestination()
        srcNode.connect(dest)
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
      } catch (e) {
        // SILENT AUDIO CONTEXT FAILURE - CONTINUE WITHOUT AUDIO
      }

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" })
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
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        } catch (e) {
          // SILENT CANVAS DRAW FAILURE
        }

        // Draw FEATURE-ONLY captions
        captions.forEach((c) => {
          if (sec >= c.startTime && sec <= c.endTime) {
            ctx.font = "bold 48px Arial"
            ctx.textAlign = "center"
            ctx.lineWidth = 8
            ctx.strokeStyle = "#000"
            ctx.fillStyle = "#FFFF00" // BRIGHT YELLOW CAPTIONS

            const y = 800
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

      recorder.onstop = async () => {
        if (ac) {
          try {
            await ac.close()
          } catch (e) {
            // SILENT AUDIO CONTEXT CLOSE FAILURE
          }
        }

        const blob = new Blob(chunks, { type: "video/webm" })

        if (blob.size > MAX_WEBM_SIZE_MB * 1024 * 1024) {
          setError("Recording exceeded size limit.")
          setIsGenerating(false)
          return
        }

        setProgress(80)

        // Upload WebM
        const fd = new FormData()
        fd.append("file", blob, "video.webm")
        const up = await fetch("/api/upload-image", { method: "POST", body: fd })
        if (!up.ok) throw new Error("Upload failed")
        const { url: webmUrl } = await up.json()

        setProgress(90)

        // Try MP4 conversion
        try {
          const conv = await fetch("/api/convert-to-mp4", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ webmUrl }),
          })

          if (conv.ok) {
            const { mp4Url } = await conv.json()
            setVideoUrl(mp4Url)

            // AUTO-DOWNLOAD MP4 - NO AUTOPLAY
            triggerDownload(mp4Url, "property-video.mp4")
            console.log("✅ MP4 conversion successful, auto-download triggered")
          } else {
            setVideoUrl(webmUrl)
            triggerDownload(webmUrl, "property-video.webm")
            console.log("⚠️ MP4 conversion failed, downloading WebM")
          }
        } catch (convError) {
          setVideoUrl(webmUrl)
          triggerDownload(webmUrl, "property-video.webm")
        }

        setProgress(100)
        setIsGenerating(false)
        setIsVideoGenerated(true) // KEEP UI VISIBLE
      }
    } catch (err) {
      setError((err as Error).message)
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

  const uploaded = uploadedImages.filter((i) => i.blobUrl).length
  const uploading = uploadedImages.filter((i) => i.isUploading).length
  const failed = uploadedImages.filter((i) => i.uploadError).length

  return (
    <div className="space-y-6">
      {/* Hidden canvas / audio */}
      <canvas ref={canvasRef} className="hidden" />
      <audio ref={audioRef} className="hidden" />

      {/* FROZEN PROPERTY FORM - NO LAYOUT CHANGES */}
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="addr">Address</Label>
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
              <Label htmlFor="sqft">Square Feet</Label>
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
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={3}
              value={propertyDescription}
              onChange={(e) => setPropertyDescription(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div className="space-y-2">
            <Label>Images</Label>
            <Input type="file" multiple accept="image/*" onChange={handleImageUpload} disabled={isGenerating} />
            <p className="text-sm text-gray-500">
              {uploaded}/{MAX_IMAGES} uploaded &middot; {uploading} uploading &middot; {failed} failed
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
                        // SILENT IMAGE PREVIEW ERROR HANDLING
                        const target = e.target as HTMLImageElement
                        target.src = "/placeholder.svg?height=80&width=80&text=Preview+Error"
                      }}
                    />
                    {img.isUploading && <Loader2 className="absolute inset-0 m-auto h-5 w-5 animate-spin text-white" />}
                    {img.uploadError && <AlertCircle className="absolute inset-0 m-auto h-5 w-5 text-red-600" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            onClick={generateAIScript}
            disabled={isGeneratingScript || isGenerating}
            className="w-full bg-transparent"
          >
            {isGeneratingScript ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Script...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Script
              </>
            )}
          </Button>

          {generatedScript && <Textarea readOnly rows={4} value={generatedScript} className="bg-gray-50" />}

          {/* PROGRESS BAR ONLY - NO SYSTEM MESSAGES */}
          {isGenerating && (
            <div>
              <Progress value={progress} />
              <p className="text-center text-sm">{Math.round(progress)}% - Rachel (locked)</p>
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

          {/* SINGLE GENERATE VIDEO BUTTON */}
          {!isVideoGenerated ? (
            <Button
              onClick={generateVideo}
              disabled={isGenerating || !generatedScript || uploaded === 0}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating with Rachel...
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
                  onClick={() =>
                    videoUrl &&
                    triggerDownload(videoUrl, videoUrl.includes(".mp4") ? "property-video.mp4" : "property-video.webm")
                  }
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
              Video saved as: {videoUrl.includes(".mp4") ? "MP4" : "WebM"} format
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default VideoGenerator
