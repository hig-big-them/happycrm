"use client"

import { usePWA } from '../hooks/use-pwa'
import { usePlatform } from '../hooks/use-platform'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'

export function PWAStatus() {
  const pwa = usePWA()
  const platform = usePlatform()

  // PWA Status available in all environments

  return (
    <Card className="fixed top-4 right-4 w-72 z-50 bg-background/95 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">PWA Debug Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span>Platform:</span>
          <Badge variant="outline">{platform.platform}</Badge>
        </div>
        <div className="flex justify-between">
          <span>Standalone:</span>
          <Badge variant={pwa.isStandalone ? "default" : "secondary"}>
            {pwa.isStandalone ? "Yes" : "No"}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>PWA Ready:</span>
          <Badge variant={pwa.isPWAReady ? "default" : "destructive"}>
            {pwa.isPWAReady ? "Yes" : "No"}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Can Install:</span>
          <Badge variant={pwa.canInstall ? "default" : "secondary"}>
            {pwa.canInstall ? "Yes" : "No"}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Show Prompt:</span>
          <Badge variant={pwa.showInstallPrompt ? "default" : "secondary"}>
            {pwa.showInstallPrompt ? "Yes" : "No"}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Mobile:</span>
          <Badge variant={platform.isMobile ? "default" : "secondary"}>
            {platform.isMobile ? "Yes" : "No"}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>iOS:</span>
          <Badge variant={platform.isIOS ? "default" : "secondary"}>
            {platform.isIOS ? "Yes" : "No"}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Capacitor:</span>
          <Badge variant={platform.isCapacitor ? "default" : "secondary"}>
            {platform.isCapacitor ? "Yes" : "No"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
} 