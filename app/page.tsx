"use client";

import { useState, useRef, type ChangeEvent } from "react";
import {
  Loader2,
  AlertCircle,
  XCircle,
  Wand2,
  Play,
  Download,
  RotateCcw,
  CheckCircle,
  UploadCloud,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import { createClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

/* ------------------------- Supabase (client-side) ------------------------ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const IMAGES_BUCKET = "images"; // make sure this bucket exists and is public

async function uploadImagesToSupabase(files: File[]): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    // compress before upload to keep payloads light
    const compressed = await imageCompression(file, {
      maxSizeMB: 5,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.8,
    });

    const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(key, compressed, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/jpeg",
      });

    if (upErr) {
      console.error("Supabase upload error:", upErr);
      throw upErr;
    }

    const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(key);
    urls.push(data.publicUrl);
  }

  return urls;
}

/* ---------------------------- Utility helpers ---------------------------- */

function normalizeAddressText(text: string): string {
  return text
    .replace(/\bDr\.?\b/gi, "Drive")
    .replace(/\bSt\.?\b/gi, "Street")
    .replace(/\bAve\.?\b/gi, "Avenue")
    .replace(/\bRd\.?\b/gi, "Road")
    .replace(/\bBlvd\.?\b/gi, "Boulevard")
    .replace(/\bLn\.?\b/gi, "Lane")
    .replace(/\bHwy\.?\b/gi, "Highway")
    .replace(/\bCt\.?\b/gi, "Court")
    .replace(/\bPl\.?\b/gi, "Place");
}

interface UploadedImage {
  id: string;
  fileName: string;
  previewUrl: string; // public URL
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

interface Caption {
  text: string;
  startTime: number;
  endTime: number;
}

const MAX_IMAGES = 30;

async function handleResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || "Request failed." };
  }
}

/* --------------------------------- UI ----------------------------------- */

function VideoGenerator() {
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [sqft, setSqft] = useState("");
  const [propertyDescription, setPropertyDescription] = useState("");

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [generatedScript, setGeneratedScript] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVideoGenerated, setIsVideoGenerated] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const markStatus = (id: string, status: UploadedImage["status"], data?: Partial<UploadedImage>) => {
    setUploadedImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, status, ...data } : img)),
    );
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_IMAGES - uploadedImages.length);
    if (files.length === 0) return;

    // Add placeholders while uploading
    const pending: UploadedImage[] = files.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: f.name,
      previewUrl: "",
      status: "pending",
    }));
    setUploadedImages((prev) => [...prev, ...pending]);

    try {
      // show uploading state
      pending.forEach((p) => markStatus(p.id, "uploading"));

      // upload → get public URLs
      const urls = await uploadImagesToSupabase(files);

      // mark success + attach URLs
      setUploadedImages((prev) =>
        prev.map((img) => {
          if (pending.some((p) => p.id === img.id)) {
            const nextUrl = urls.shift() || "";
            return { ...img, previewUrl: nextUrl, status: "success" };
          }
          return img;
        }),
      );
    } catch (err: any) {
      console.error(err);
      setUploadedImages((prev) =>
        prev.map((img) =>
          pending.some((p) => p.id === img.id)
            ? { ...img, status: "error", error: err?.message || "Upload failed" }
            : img,
        ),
      );
    } finally {
      e.target.value = "";
    }
  };

  const removeImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const retryFailedUploads = async () => {
    const failed = uploadedImages.filter((i) => i.status === "error");
    if (failed.length === 0) return;

    // We don't have original File objects anymore (we uploaded and only keep URLs),
    // so the sensible UX here is to ask user to reselect those files.
    setError("Please reselect the failed photos and upload again.");
    setTimeout(() => setError(null), 4000);
  };

  const generateAIScript = async () => {
    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      setScriptError("Please fill in all property details first.");
      return;
    }

    setIsGeneratingScript(true);
    setScriptError(null);
    setGeneratedScript("");

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
      });

      const result = await handleResponse(response);
      if (!response.ok) throw new Error(result.error || "Script generation failed");
      setGeneratedScript(result.script);
    } catch (err: any) {
      setScriptError(err?.message || "Failed to generate script");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const createPropertyCaptions = (duration: number): Caption[] => {
    const caps: Caption[] = [];
    if (bedrooms) caps.push({ text: `${bedrooms} ${Number(bedrooms) === 1 ? "BEDROOM" : "BEDROOMS"}`, startTime: 0, endTime: 0 });
    if (bathrooms) caps.push({ text: `${bathrooms} ${Number(bathrooms) === 1 ? "BATHROOM" : "BATHROOMS"}`, startTime: 0, endTime: 0 });
    if (sqft) caps.push({ text: `${Number(sqft).toLocaleString()} SQ FT`, startTime: 0, endTime: 0 });
    if (price) caps.push({ text: `$${Number(price).toLocaleString()}`, startTime: 0, endTime: 0 });

    if (propertyDescription) {
      const features = propertyDescription.match(
        /pool|garage|fireplace|deck|patio|yard|upgraded|renovated|corner lot|detached|shop/gi,
      );
      if (features && features.length > 0) {
        caps.push({ text: features[0].toUpperCase(), startTime: 0, endTime: 0 });
      }
    }

    const timePer = duration / Math.max(caps.length, 1);
    return caps.map((c, i) => ({ ...c, startTime: i * timePer + 1, endTime: (i + 1) * timePer }));
  };

  function triggerDownload(url: string, filename: string) {
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      })
      .catch((err) => {
        console.error("Download failed:", err);
        setError("Download failed. Please try again.");
      });
  }

  const generateVideo = async () => {
    const okUploads = uploadedImages.filter((i) => i.status === "success" && i.previewUrl);
    if (okUploads.length === 0) {
      setError("Please upload at least one image successfully.");
      return;
    }
    if (!generatedScript) {
      setError("Please generate the AI script first.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);
    setIsVideoGenerated(false);
    setProgress(0);

    try {
      // 1) Rachel audio
      setProgress(15);
      const normalizedScript = normalizeAddressText(generatedScript);
      const audioResp = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: normalizedScript }),
      });

      if (!audioResp.ok) {
        const e = await handleResponse(audioResp);
        throw new Error(e.error || "Failed to generate Rachel's voiceover");
      }

      const audioBlob = await audioResp.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const duration = Number(audioResp.headers.get("X-Audio-Duration")) || 30;

      // 2) Captions
      setProgress(25);
      const captions = createPropertyCaptions(duration);

      // 3) Load images (public URLs)
      setProgress(35);
      const imgs = await Promise.all(
        okUploads.map(
          (u) =>
            new Promise<HTMLImageElement | null>((resolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => resolve(img);
              img.onerror = () => resolve(null);
              img.src = u.previewUrl;
            }),
        ),
      ).then((arr) => arr.filter((x): x is HTMLImageElement => x !== null));

      if (imgs.length === 0) throw new Error("No images could be loaded.");

      // 4) Canvas
      setProgress(45);
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.width = 1080;
      canvas.height = 1920;

      const audio = audioRef.current!;
      audio.src = audioUrl;
      audio.muted = true;

      // 5) Record
      setProgress(55);
      const stream = canvas.captureStream(30);
      let audioContext: AudioContext | null = null;

      try {
        audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(audio);
        const dest = audioContext.createMediaStreamDestination();
        source.connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch (err) {
        console.error("Audio context setup failed:", err);
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 3_000_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);

      recorder.start();
      audio.muted = false;
      await audio.play();

      // 6) Render loop
      setProgress(65);
      const timePerImage = duration / imgs.length;
      let frameCount = 0;
      const totalFrames = duration * 30;

      const animate = () => {
        if (audio.paused || audio.ended) {
          recorder.stop();
          return;
        }

        const elapsed = audio.currentTime;
        const idx = Math.min(Math.floor(elapsed / timePerImage), imgs.length - 1);
        const img = imgs[idx];

        // black bg
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // cover-fit draw
        const imgAspect = img.width / img.height;
        const canvasAspect = canvas.width / canvas.height;
        let drawW, drawH, drawX, drawY;

        if (imgAspect > canvasAspect) {
          drawH = canvas.height;
          drawW = drawH * imgAspect;
          drawX = (canvas.width - drawW) / 2;
          drawY = 0;
        } else {
          drawW = canvas.width;
          drawH = drawW / imgAspect;
          drawX = 0;
          drawY = (canvas.height - drawH) / 2;
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        // captions
        captions.forEach((cap) => {
          if (elapsed >= cap.startTime && elapsed <= cap.endTime) {
            ctx.font = "bold 90px Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = "#FFFF00";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 4;
            const y = canvas.height - 300;
            ctx.strokeText(cap.text, canvas.width / 2, y);
            ctx.fillText(cap.text, canvas.width / 2, y);
          }
        });

        const recProg = 65 + (frameCount / totalFrames) * 20;
        setProgress(Math.min(recProg, 85));
        frameCount++;
        requestAnimationFrame(animate);
      };
      animate();

      // 7) Upload WebM → convert MP4
      recorder.onstop = async () => {
        try {
          if (audioContext) await audioContext.close();

          const webmBlob = new Blob(chunks, { type: "video/webm" });
          setProgress(90);

          const fd = new FormData();
          fd.append("file", webmBlob, "snapsold-video.webm");

          const up = await fetch("/api/upload-video", { method: "POST", body: fd });
          const upRes = await handleResponse(up);
          if (!up.ok) throw new Error(upRes.error || "Failed to upload video for processing");

          const { url: webmUrl } = upRes;
          setProgress(95);

          const mp4Resp = await fetch("/api/process-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ webmUrl }),
          });
          const mp4Res = await handleResponse(mp4Resp);
          if (!mp4Resp.ok) throw new Error(mp4Res.error || "Failed to process video to MP4");

          const { mp4Url } = mp4Res;
          if (!mp4Url) throw new Error("MP4 processing failed.");

          setVideoUrl(mp4Url);
          setProgress(100);
          setIsVideoGenerated(true);
          setIsGenerating(false);

          triggerDownload(mp4Url, "snapsold-property-video.mp4");
        } catch (err: any) {
          console.error("Video processing error:", err);
          setError(err?.message || "Something went wrong. Please try again.");
          setIsGenerating(false);
          setProgress(0);
        }
      };
    } catch (err: any) {
      console.error("Video generation error:", err);
      setError(err?.message || "Something went wrong. Please try again.");
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const resetForNewVideo = () => {
    setVideoUrl(null);
    setIsVideoGenerated(false);
    setProgress(0);
    setError(null);
  };

  const successfulUploadCount = uploadedImages.filter((i) => i.status === "success").length;
  const uploadingCount = uploadedImages.filter((i) => i.status === "uploading").length;
  const failedCount = uploadedImages.filter((i) => i.status === "error").length;

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
            {/* Details */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="addr">Property Address</Label>
                <Input
                  id="addr"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isGenerating}
                  placeholder="2703 Main St, City, State 12345"
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
                  placeholder="1.5"
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
                  placeholder="2703"
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
                placeholder="Describe special features like pool, garage, upgraded kitchen, corner lot, etc..."
                rows={3}
              />
            </div>

            {/* Upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>
                  Upload Property Photos (up to {MAX_IMAGES})
                  {uploadedImages.length > 0 && (
                    <span className="ml-2 text-sm text-gray-500">
                      {successfulUploadCount} uploaded, {uploadingCount} uploading, {failedCount} failed
                    </span>
                  )}
                </Label>
                {failedCount > 0 && (
                  <Button onClick={retryFailedUploads} variant="outline" size="sm" disabled={isGenerating}>
                    Retry Failed
                  </Button>
                )}
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500">
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
                <p className="text-sm text-gray-500 mt-2">JPG, PNG, WebP • Auto-resized to 1280px max width</p>
              </div>

              {/* Thumbs */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 max-h-64 overflow-y-auto">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="relative aspect-square group">
                      <img
                        src={img.previewUrl || "/placeholder.svg"}
                        alt={img.fileName}
                        className="h-full w-full object-cover rounded-lg border-2 border-gray-200"
                      />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        {img.status === "uploading" && (
                          <div className="text-center">
                            <Loader2 className="h-4 w-4 animate-spin text-white mx-auto" />
                            <p className="text-xs text-white mt-1">Uploading</p>
                          </div>
                        )}
                        {img.status === "success" && <CheckCircle className="h-6 w-6 text-green-400" />}
                        {img.status === "error" && (
                          <div className="text-center">
                            <AlertCircle className="h-6 w-6 text-red-400 mx-auto" />
                            <p className="text-xs text-white mt-1" title={img.error}>
                              Failed
                            </p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={isGenerating}
                      >
                        <XCircle className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Script */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="script">AI-Generated Script (Preview & Edit)</Label>
                <Button onClick={generateAIScript} disabled={isGeneratingScript || isGenerating} variant="outline" size="sm">
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

              {scriptError && (
                <div className="flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="flex-1">{scriptError}</span>
                  <Button size="icon" variant="ghost" onClick={() => setScriptError(null)} className="ml-2 h-6 w-6 hover:bg-red-100">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <Textarea
                id="script"
                value={generatedScript}
                onChange={(e) => setGeneratedScript(e.target.value)}
                rows={5}
                disabled={isGenerating}
                placeholder="Click 'Generate Script' to create an engaging script with natural number pronunciation. You can preview and edit it before generating the video."
              />
            </div>

            {/* Progress */}
            {isGenerating && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full h-3" />
                <p className="text-center text-sm text-gray-600">Generating... {Math.round(progress)}%</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="flex-1">{error}</span>
                <Button size="icon" variant="ghost" onClick={() => setError(null)} className="ml-2 h-6 w-6 hover:bg-red-100">
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* CTA */}
            {!isVideoGenerated ? (
              <Button
                onClick={generateVideo}
                disabled={isGenerating || successfulUploadCount === 0 || !generatedScript}
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 shadow-lg disabled:opacity-50"
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
                    Generate Video
                  </>
                )}
              </Button>
            ) : (
              <div className="text-center space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => videoUrl && triggerDownload(videoUrl, "snapsold-property-video.mp4")}
                    disabled={!videoUrl}
                    className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download MP4
                  </Button>
                  <Button onClick={resetForNewVideo} variant="outline" className="w-full bg-transparent">
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
  );
}

export default function Home() {
  return <VideoGenerator />;
}

// Forced update for Vercel redeploy