"use client"

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { X, Smartphone, Download } from 'lucide-react'
import { usePWA, isIOSDevice, getIOSInstallInstructions, getAndroidInstallInstructions } from '../hooks/use-pwa'

export function PWAInstallBanner() {
  const { isStandalone, canInstall, showInstallPrompt, installPWA, dismissInstallPrompt } = usePWA()
  const [showInstructions, setShowInstructions] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // PWA Install Banner enabled for production

  // Don't show if already installed or dismissed
  if (isStandalone || dismissed) return null

  let isIOS = false
  try {
    isIOS = isIOSDevice()
  } catch (error) {
    console.warn('iOS detection failed:', error)
  }
  
  const handleInstall = async () => {
    if (canInstall) {
      await installPWA()
    } else if (isIOS) {
      setShowInstructions(true)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    dismissInstallPrompt()
  }

  if (showInstructions) {
    const instructions = isIOS ? getIOSInstallInstructions() : getAndroidInstallInstructions()
    
    return (
      <Card className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto border-primary shadow-lg">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-sm">Uygulamayı Yükle</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowInstructions(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            {instructions.map((step, index) => (
              <p key={index} className="text-xs text-muted-foreground">
                {step}
              </p>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={() => setShowInstructions(false)}
          >
            Anladım
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!showInstallPrompt) return null

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto border-primary shadow-lg">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Uygulamayı Yükle</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground mb-3">
          Happy CRM'i cihazınıza yükleyerek daha hızlı erişim sağlayın!
        </p>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleDismiss}
          >
            Sonra
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleInstall}
          >
            <Download className="h-4 w-4 mr-1" />
            Yükle
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 