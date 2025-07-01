/**
 * 🖼️ Lazy Loading Media Viewer Component
 * 
 * Performance-optimized image/video lazy loading ve preview
 */

"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { 
  Image as ImageIcon, 
  Video, 
  File, 
  Download, 
  Maximize2, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Loader2,
  AlertCircle,
  FileText,
  Music,
  X,
  ExternalLink
} from 'lucide-react';

// 📋 Media Types
interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  thumbnail_url?: string;
  filename?: string;
  size?: number;
  mime_type?: string;
  duration?: number; // for video/audio
  caption?: string;
  alt_text?: string;
}

// 🎨 Media Type Configuration
const MEDIA_CONFIG = {
  image: {
    icon: <ImageIcon className="h-4 w-4" />,
    color: 'bg-blue-500',
    supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  video: {
    icon: <Video className="h-4 w-4" />,
    color: 'bg-red-500',
    supportedFormats: ['video/mp4', 'video/webm', 'video/ogg'],
    maxSize: 100 * 1024 * 1024, // 100MB
  },
  audio: {
    icon: <Music className="h-4 w-4" />,
    color: 'bg-green-500',
    supportedFormats: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac'],
    maxSize: 25 * 1024 * 1024, // 25MB
  },
  document: {
    icon: <FileText className="h-4 w-4" />,
    color: 'bg-purple-500',
    supportedFormats: ['application/pdf', 'application/msword', 'text/plain'],
    maxSize: 50 * 1024 * 1024, // 50MB
  }
};

// 🖼️ Lazy Image Component
const LazyImage = React.memo(({ 
  src, 
  alt, 
  className = "", 
  onLoad, 
  onError,
  placeholder 
}: {
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  placeholder?: React.ReactNode;
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | undefined>();
  
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  useEffect(() => {
    if (inView && !imageSrc) {
      setImageSrc(src);
    }
  }, [inView, src, imageSrc]);

  const handleLoad = useCallback(() => {
    setLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setLoading(false);
    setError(true);
    onError?.();
  }, [onError]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {!imageSrc ? (
        // Placeholder while not in view
        <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
          {placeholder || <ImageIcon className="h-8 w-8 text-gray-400" />}
        </div>
      ) : error ? (
        // Error state
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Görsel yüklenemedi</p>
          </div>
        </div>
      ) : (
        <>
          {loading && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
          <img
            src={imageSrc}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              loading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={handleLoad}
            onError={handleError}
          />
        </>
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';

// 🎬 Lazy Video Component
const LazyVideo = React.memo(({ 
  src, 
  poster, 
  className = "",
  controls = true,
  autoPlay = false,
  muted = true 
}: {
  src: string;
  poster?: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  const handleLoadedData = useCallback(() => {
    setLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  if (!inView) {
    return (
      <div ref={ref} className={`relative bg-gray-200 animate-pulse flex items-center justify-center ${className}`}>
        <Video className="h-8 w-8 text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Video yüklenemedi</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative group ${className}`}>
      {loading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center z-10">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
      
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        className="w-full h-full object-cover"
        onLoadedData={handleLoadedData}
        onError={handleError}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      
      {/* Custom Controls Overlay */}
      {!controls && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black bg-opacity-50 rounded-full p-2 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlay}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

LazyVideo.displayName = 'LazyVideo';

// 📄 Document Preview Component
const DocumentPreview = React.memo(({ 
  media,
  className = "" 
}: { 
  media: MediaItem;
  className?: string;
}) => {
  const config = MEDIA_CONFIG[media.type];
  const fileSize = media.size ? formatFileSize(media.size) : '';
  
  return (
    <Card className={`${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.color} text-white`}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{media.filename || 'Belge'}</p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{media.mime_type}</span>
              {fileSize && <span>• {fileSize}</span>}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" asChild>
              <a href={media.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={media.url} download={media.filename}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

DocumentPreview.displayName = 'DocumentPreview';

// 🎯 Main Media Viewer Component
interface LazyMediaViewerProps {
  media: MediaItem;
  className?: string;
  showCaption?: boolean;
  showFullscreenButton?: boolean;
  maxHeight?: string;
  onMediaClick?: (media: MediaItem) => void;
}

export default function LazyMediaViewer({
  media,
  className = "",
  showCaption = true,
  showFullscreenButton = true,
  maxHeight = "300px",
  onMediaClick
}: LazyMediaViewerProps) {
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const handleMediaClick = useCallback(() => {
    onMediaClick?.(media);
    if (media.type === 'image' || media.type === 'video') {
      setIsFullscreenOpen(true);
    }
  }, [media, onMediaClick]);

  const handleDownload = useCallback(async () => {
    try {
      setDownloadProgress(0);
      
      const response = await fetch(media.url);
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream not readable');
      
      const chunks: Uint8Array[] = [];
      let received = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        received += value.length;
        
        if (total > 0) {
          setDownloadProgress((received / total) * 100);
        }
      }
      
      const blob = new Blob(chunks);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = media.filename || `media-${media.id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setDownloadProgress(null);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadProgress(null);
    }
  }, [media]);

  const renderMediaContent = () => {
    switch (media.type) {
      case 'image':
        return (
          <div 
            className="relative cursor-pointer group"
            style={{ maxHeight }}
            onClick={handleMediaClick}
          >
            <LazyImage
              src={media.url}
              alt={media.alt_text || media.filename || 'Görsel'}
              className="w-full h-full rounded-lg"
            />
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
              {showFullscreenButton && (
                <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </div>
        );
      
      case 'video':
        return (
          <div 
            className="relative cursor-pointer"
            style={{ maxHeight }}
            onClick={handleMediaClick}
          >
            <LazyVideo
              src={media.url}
              poster={media.thumbnail_url}
              className="w-full h-full rounded-lg"
              controls={false}
              muted={true}
            />
          </div>
        );
      
      case 'audio':
        return (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500 text-white">
                  <Music className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{media.filename || 'Ses dosyası'}</p>
                  {media.duration && (
                    <p className="text-sm text-gray-500">
                      Süre: {formatDuration(media.duration)}
                    </p>
                  )}
                </div>
              </div>
              <audio controls className="w-full mt-3">
                <source src={media.url} type={media.mime_type} />
                Tarayıcınız ses dosyasını desteklemiyor.
              </audio>
            </CardContent>
          </Card>
        );
      
      case 'document':
        return <DocumentPreview media={media} />;
      
      default:
        return (
          <Card>
            <CardContent className="p-4 text-center">
              <File className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">Desteklenmeyen dosya türü</p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Media Content */}
      {renderMediaContent()}
      
      {/* Caption */}
      {showCaption && media.caption && (
        <p className="text-sm text-gray-600 px-2">{media.caption}</p>
      )}
      
      {/* Actions */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {MEDIA_CONFIG[media.type].icon}
            {media.type.toUpperCase()}
          </Badge>
          {media.size && (
            <span className="text-xs text-gray-500">
              {formatFileSize(media.size)}
            </span>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={downloadProgress !== null}
        >
          {downloadProgress !== null ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {Math.round(downloadProgress)}%
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              İndir
            </>
          )}
        </Button>
      </div>
      
      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{media.filename || 'Medya Görüntüleyici'}</DialogTitle>
            {media.caption && (
              <DialogDescription>{media.caption}</DialogDescription>
            )}
          </DialogHeader>
          
          <div className="p-4 max-h-[70vh] overflow-auto">
            {media.type === 'image' ? (
              <img
                src={media.url}
                alt={media.alt_text || media.filename || 'Görsel'}
                className="w-full h-auto max-h-full object-contain"
              />
            ) : media.type === 'video' ? (
              <video
                src={media.url}
                controls
                className="w-full h-auto max-h-full"
                autoPlay
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 🛠️ Utility Functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 🧩 Export sub-components
export { LazyImage, LazyVideo, DocumentPreview };