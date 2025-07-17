"use client"

/*
  This is the full VideoGenerator component that was previously
  in app/page.tsx. Nothing else in the project changes.
*/

import { useState, useRef, useCallback, type ChangeEvent } from "react"
import { Loader2, AlertCircle, XCircle, Wand2, Play, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

/* ---------- types ---------- */

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

/* ---------- helpers ---------- */

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

/* converts “123 Main Dr” -> “123 Main Drive” */
function expandStreetAbbreviations(address: string) {
  return address
    .split(" ")
    .map((word) => STREET_ABBREVIATIONS[word] ?? word)
    .join(" ")
}

const MAX_IMAGES = 30
const MAX_WEBM_SIZE_MB = 200 // raise limit so MP4 conversion doesn’t fail

/* ---------- component ---------- */

export function VideoGenerator() {
  /* form state */
  const [address, setAddress] = useState("")
  const [price, setPrice] = useState("")
  const [bedrooms, setBedrooms] = useState("")
  const [bathrooms, setBathrooms] = useState("")
  const [sqft, setSqft] = useState("")
  const [propertyDescription, setPropertyDescription] = useState("")

  /* upload state */
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])

  /* generation state */
  const [generatedScript, setGeneratedScript] = useState("")
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  /* ---------- utility functions (image compress & upload) ---------- */

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

  /* ---------- handlers ---------- */

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
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((i) => i.id !== id)
    })
  }

  /* ---------- AI script generation ---------- */

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

  /* ---------- caption generation ---------- */

  const makeCaptions = (duration: number): Caption[] => {
    const caps: Caption[] = []

    // bedrooms / bathrooms abbreviations
    const br = Number(bedrooms)
    const ba = Number(bathrooms)
    const sqftNum = Number(sqft)
    const priceNum = Number(price)

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

  /* ---------- video generation (same as earlier) ---------- */

  const loadImage = useCallback((src: string) => {
    return new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => res(img)
      img.onerror = rej
      img.src = src
    })
  }, [])

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

    try {
      /* ---- generate audio ---- */
      const audioResp = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: generatedScript }),
      })
      if (!audioResp.ok) throw new Error("Audio generation failed")
      const { audioUrl, duration } = await audioResp.json()
      setProgress(20)

      /* ---- captions ---- */
      const captions = makeCaptions(duration)
      setProgress(25)

      /* ---- load images ---- */
      const imgs = []
      for (const up of uploadedImages.filter((u) => u.blobUrl)) {
        imgs.push(await loadImage(up.blobUrl!))
      }
      setProgress(35)

      /* ---- setup canvas & audio ---- */
      const canvas = canvasRef.current!
      const ctx = canvas.getContext("2d")!
      canvas.width = 576
      canvas.height = 1024

      const audio = audioRef.current!
      audio.src = audioUrl
      audio.muted = true
      await audio.play().catch(() => {})
      audio.pause()
      audio.currentTime = 0

      const ac = new AudioContext()
      const srcNode = ac.createMediaElementSource(audio)
      const dest = ac.createMediaStreamDestination()
      srcNode.connect(dest)

      const stream = canvas.captureStream(30)
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)

      recorder.start(100)
      audio.muted = false
      audio.play()

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

        /* draw */
        const idx = Math.min(Math.floor(elapsed / perImg), imgs.length - 1)
        const img = imgs[idx]
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        /* captions */
        captions.forEach((c) => {
          if (sec >= c.startTime && sec <= c.endTime) {
            ctx.font = "bold 48px Arial"
            ctx.textAlign = "center"
            ctx.lineWidth = 8
            ctx.strokeStyle = "#000"
            ctx.fillStyle =
              c.type === "price"
                ? "#00FF00"
                : c.type === "location"
                  ? "#FF4444"
                  : c.type === "bedrooms"
                    ? "#00CCFF"
                    : c.type === "bathrooms"
                      ? "#FF00FF"
                      : c.type === "sqft"
                        ? "#FFFF00"
                        : "#FF8800"

            const y = 800
            ctx.strokeText(c.text, canvas.width / 2, y)
            ctx.fillText(c.text, canvas.width / 2, y)
          }
        })

        setProgress(35 + (sec / duration) * 40)
        requestAnimationFrame(animate)
      }
      animate()

      /* ---- handle stop ---- */
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" })

        if (blob.size > MAX_WEBM_SIZE_MB * 1024 * 1024) {
          setError("Recording exceeded size limit.")
          setIsGenerating(false)
          return
        }

        /* upload webm */
        const fd = new FormData()
        fd.append("file", blob, "video.webm")
        const up = await fetch("/api/upload-image", { method: "POST", body: fd })
        if (!up.ok) throw new Error("Upload failed")
        const { url: webmUrl } = await up.json()

        /* convert to MP4 */
        const conv = await fetch("/api/convert-to-mp4", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ webmUrl }),
        })

        if (conv.ok) {
          const { mp4Url } = await conv.json()
          setVideoUrl(mp4Url)

          /* auto-download */
          const a = document.createElement("a")
          a.href = mp4Url
          a.download = "property-video.mp4"
          a.click()
        } else {
          setVideoUrl(webmUrl)
        }

        setProgress(100)
        setIsGenerating(false)
      }
    } catch (err) {
      setError((err as Error).message)
      setIsGenerating(false)
    }
  }

  /* ---------- render ---------- */

  const uploaded = uploadedImages.filter((i) => i.blobUrl).length
  const uploading = uploadedImages.filter((i) => i.isUploading).length
  const failed = uploadedImages.filter((i) => i.uploadError).length

  return (
    <div className="space-y-6">
      {/* hidden canvas / audio */}
      <canvas ref={canvasRef} className="hidden" />
      <audio ref={audioRef} className="hidden" />

      {/* property form */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* address / price */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="addr">Address</Label>
              <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="price">Price ($)</Label>
              <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          {/* br/ba/sqft */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="br">Bedrooms</Label>
              <Input id="br" type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ba">Bathrooms</Label>
              <Input
                id="ba"
                type="number"
                step="0.5"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sqft">Square Feet</Label>
              <Input id="sqft" type="number" value={sqft} onChange={(e) => setSqft(e.target.value)} />
            </div>
          </div>
          {/* description */}
          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={3}
              value={propertyDescription}
              onChange={(e) => setPropertyDescription(e.target.value)}
            />
          </div>

          {/* image upload */}
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
                      className="h-20 w-full object-cover rounded border"
                      onClick={() => removeImage(img.id)}
                    />
                    {img.isUploading && <Loader2 className="absolute inset-0 m-auto h-5 w-5 animate-spin text-white" />}
                    {img.uploadError && <AlertCircle className="absolute inset-0 m-auto h-5 w-5 text-red-600" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* generate script */}
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

          {/* progress */}
          {isGenerating && (
            <div>
              <Progress value={progress} />
              <p className="text-center text-sm">{Math.round(progress)}%</p>
            </div>
          )}

          {/* error */}
          {error && (
            <div className="flex items-center text-sm text-red-600">
              <AlertCircle className="h-4 w-4 mr-1" /> {error}
              <Button size="icon" variant="ghost" onClick={() => setError(null)} className="ml-auto h-6 w-6">
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* generate video */}
          <Button
            onClick={generateVideo}
            disabled={isGenerating || !generatedScript || uploaded === 0}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Generate Video
              </>
            )}
          </Button>

          {/* video preview */}
          {videoUrl && (
            <div className="space-y-2 text-center">
              <video src={videoUrl} controls className="w-full rounded" style={{ aspectRatio: "9/16" }} />
              <Button
                onClick={() => {
                  const a = document.createElement("a")
                  a.href = videoUrl
                  a.download = videoUrl.includes(".mp4") ? "property-video.mp4" : "property-video.webm"
                  a.click()
                }}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
