"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, Sparkles, X } from "lucide-react"

interface UploadedImage {
  url: string
  filename: string
  file: File
}

export default function VideoGenerator() {
  const [formData, setFormData] = useState({
    address: "",
    price: "",
    bedrooms: "",
    bathrooms: "",
    sqft: "",
    propertyDescription: "",
  })

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [script, setScript] = useState("")
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [uploadError, setUploadError] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileUpload = async (files: FileList) => {
    setUploadError("")
    const maxFiles = 30
    const currentCount = uploadedImages.length
    const filesToUpload = Array.from(files).slice(0, maxFiles - currentCount)

    for (const file of filesToUpload) {
      try {
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`)
        }

        const result = await response.json()

        setUploadedImages((prev) => [
          ...prev,
          {
            url: result.url,
            filename: result.filename,
            file: file,
          },
        ])
      } catch (error) {
        console.error("Upload error:", error)
        setUploadError(`Failed to upload ${file.name}`)
      }
    }
  }

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const generateScript = async () => {
    if (!formData.address || !formData.price || !formData.bedrooms || !formData.bathrooms || !formData.sqft) {
      setError("Please fill in all required property details")
      return
    }

    setIsGeneratingScript(true)
    setError("")

    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          imageCount: uploadedImages.length,
        }),
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const result = await response.json()
      setScript(result.script)
    } catch (error) {
      console.error("Script generation error:", error)
      setError("Failed to generate script. Please try again.")
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const generateVideo = async () => {
    if (!script || uploadedImages.length === 0) {
      setError("Please generate a script and upload images first")
      return
    }

    setIsGeneratingVideo(true)
    setProgress(0)
    setError("")

    try {
      // Step 1: Generate audio (25%)
      setProgress(25)
      const audioResponse = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      })

      if (!audioResponse.ok) {
        throw new Error("Audio generation failed")
      }

      const audioBlob = await audioResponse.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      // Step 2: Create slideshow (50%)
      setProgress(50)
      const slideshowResponse = await fetch("/api/create-slideshow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: uploadedImages.map((img) => img.url),
          audioUrl,
          script,
          propertyDetails: formData,
        }),
      })

      if (!slideshowResponse.ok) {
        throw new Error("Slideshow creation failed")
      }

      const slideshowResult = await slideshowResponse.json()

      // Step 3: Convert to MP4 (75%)
      setProgress(75)
      const mp4Response = await fetch("/api/convert-to-mp4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: slideshowResult.videoUrl }),
      })

      if (!mp4Response.ok) {
        throw new Error("MP4 conversion failed")
      }

      const mp4Result = await mp4Response.json()

      // Step 4: Download (100%)
      setProgress(100)

      // Auto-download the MP4
      const link = document.createElement("a")
      link.href = mp4Result.mp4Url
      link.download = `property-video-${Date.now()}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Video generation error:", error)
      // Silent error handling - just reset without showing error
    } finally {
      setIsGeneratingVideo(false)
      setProgress(0)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            ✨ SnapSold ✨
          </h1>
          <p className="text-gray-600 text-lg">Create viral listing videos that sell homes fast</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardContent className="p-6 space-y-6">
            {/* Property Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Property Address</label>
                <Input
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="e.g., 123 Main St, Anytown, USA"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price ($)</label>
                <Input
                  name="price"
                  type="number"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder="e.g., 500000"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bedrooms</label>
                <Input
                  name="bedrooms"
                  type="number"
                  value={formData.bedrooms}
                  onChange={handleInputChange}
                  placeholder="e.g., 3"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bathrooms</label>
                <Input
                  name="bathrooms"
                  type="number"
                  step="0.5"
                  value={formData.bathrooms}
                  onChange={handleInputChange}
                  placeholder="e.g., 2.5"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Square Footage</label>
                <Input
                  name="sqft"
                  type="number"
                  value={formData.sqft}
                  onChange={handleInputChange}
                  placeholder="e.g., 2500"
                  className="w-full"
                />
              </div>
            </div>

            {/* Property Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Property Description & Key Features (Optional)
              </label>
              <Textarea
                name="propertyDescription"
                value={formData.propertyDescription}
                onChange={handleInputChange}
                placeholder="Describe unique features, amenities, recent upgrades..."
                className="w-full h-24"
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Property Images (Max 30){" "}
                {uploadedImages.length > 0 && `${uploadedImages.length} uploaded, 0 uploading, 0 failed`}
              </label>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                className="hidden"
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full mb-4"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Files
              </Button>

              {uploadError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-red-600 text-sm">⚠️ {uploadError}</p>
                </div>
              )}

              {uploadedImages.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-1">No images uploaded yet.</p>
                  <p className="text-gray-400 text-sm">Upload up to 30 property images</p>
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                  {uploadedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image.url || "/placeholder.svg"}
                        alt={`Property ${index + 1}`}
                        className="w-full h-16 object-cover rounded border"
                      />
                      <div className="absolute top-1 left-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        ✓
                      </div>
                      <div className="absolute top-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
                        {index + 1}
                      </div>
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Script Generation */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">AI-Generated TikTok Script</label>
                <Button onClick={generateScript} disabled={isGeneratingScript} variant="outline" size="sm">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isGeneratingScript ? "Generating..." : "Generate Script"}
                </Button>
              </div>

              <Textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Click 'Generate Script' to create an AI-powered TikTok script..."
                className="w-full h-32"
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">⚠️ {error}</p>
                <Button
                  onClick={() => setError("")}
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4 mr-1" />
                  Try Again
                </Button>
              </div>
            )}

            {/* Progress Bar */}
            {isGeneratingVideo && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Generating video...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            {/* Generate Video Button */}
            <Button
              onClick={generateVideo}
              disabled={isGeneratingVideo || !script || uploadedImages.length === 0}
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-0"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {isGeneratingVideo ? "Generating Video..." : "Generate Video"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
