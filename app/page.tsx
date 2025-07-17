"use client"
import VideoGenerator from "@/components/video-generator"

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

export default function Home() {
  return <VideoGenerator />
}
