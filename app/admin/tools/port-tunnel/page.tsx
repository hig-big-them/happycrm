'use client'

import { useState, useEffect } from 'react'
import { Button } from '../../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Badge } from '../../../../components/ui/badge'
import { Copy, ExternalLink, Terminal } from 'lucide-react'
import { Alert, AlertDescription } from '../../../../components/ui/alert'

export default function PortTunnelPage() {
  const [currentDomain, setCurrentDomain] = useState('')
  const [copiedCommand, setCopiedCommand] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentDomain(window.location.origin)
    }
  }, [])

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCommand(type)
      setTimeout(() => setCopiedCommand(''), 2000)
    } catch (err) {
      console.error('Kopyalama hatası:', err)
    }
  }

  const tunnelOptions = [
    {
      name: 'Ngrok (Development Only)',
      description: 'Local development için webhook tunneling servisi',
      difficulty: 'Kolay',
      commands: [
        '# 1. Ngrok indirin: https://ngrok.com/download',
        '# 2. Ngrok başlatın:',
        'ngrok http 3000',
        '# 3. URL\'i .env.local\'e kopyalayın'
      ],
      pros: ['Development için uygun', 'HTTPS desteği', 'Web interface'],
      cons: ['Sadece development', 'Production için değil'],
      badge: 'Dev Only'
    },
    {
      name: 'Cloudflare Tunnel',
      description: 'Cloudflare\'in ücretsiz tunneling servisi',
      difficulty: 'Orta',
      commands: [
        '# 1. Cloudflared indirin: https://github.com/cloudflare/cloudflared/releases',
        '# 2. Tunnel başlatın:',
        'cloudflared tunnel --url http://localhost:3000'
      ],
      pros: ['Ücretsiz', 'Cloudflare altyapısı', 'Hızlı'],
      cons: ['Binary indirmek gerekiyor'],
      badge: 'Ücretsiz'
    },
    {
      name: 'Serveo',
      description: 'SSH tabanlı basit tunneling',
      difficulty: 'Basit',
      commands: [
        '# SSH ile tunnel:',
        'ssh -R 80:localhost:3000 serveo.net',
        '# Özel subdomain için:',
        'ssh -R your-subdomain:80:localhost:3000 serveo.net'
      ],
      pros: ['Çok basit', 'SSH gerekiyor sadece', 'Hızlı kurulum'],
      cons: ['Güvenlik riski', 'Stabil değil'],
      badge: 'Basit'
    },
    {
      name: 'Localhost.run',
      description: 'Hızlı SSH tunneling',
      difficulty: 'Basit',
      commands: [
        '# SSH tunnel:',
        'ssh -R 80:localhost:3000 localhost.run',
        '# Custom subdomain:',
        'ssh -R 80:localhost:3000 nokey@localhost.run'
      ],
      pros: ['Hızlı', 'SSH sadece', 'Hesap gerektirmiyor'],
      cons: ['Güvenlik riski', 'URL değişebilir'],
      badge: 'Hızlı'
    },
    {
      name: 'Visual Studio Code Tunnels',
      description: 'VS Code entegreli tunnel',
      difficulty: 'Kolay',
      commands: [
        '# VS Code Command Palette açın (Ctrl+Shift+P)',
        '# "Ports: Forward a Port" seçin',
        '# Port 3000 girin',
        '# "Make Public" yapın'
      ],
      pros: ['VS Code entegreli', 'GUI', 'Microsoft desteği'],
      cons: ['VS Code gerekiyor', 'Microsoft hesabı'],
      badge: 'GUI'
    }
  ]

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Basit': return 'bg-green-100 text-green-800'
      case 'Kolay': return 'bg-blue-100 text-blue-800'
      case 'Orta': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getBadgeVariant = (badge: string) => {
    switch (badge) {
      case 'Önerilen': return 'default'
      case 'Ücretsiz': return 'secondary'
      case 'Basit': return 'outline'
      case 'Hızlı': return 'destructive'
      case 'GUI': return 'secondary'
      default: return 'outline'
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Port Tunneling Seçenekleri</h1>
        <p className="text-gray-600 mt-2">
          Development sırasında webhook'ları test etmek için port tunneling çözümleri
        </p>
      </div>

      <Alert className="mb-6">
        <Terminal className="h-4 w-4" />
        <AlertDescription>
          <strong>Mevcut Domain:</strong> {currentDomain}
          <br />
          Webhook URL: <code>{currentDomain}/api/twilio/status-webhook</code>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {tunnelOptions.map((option, index) => (
          <Card key={index} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl">{option.name}</CardTitle>
                  <Badge variant={getBadgeVariant(option.badge)}>
                    {option.badge}
                  </Badge>
                  <Badge className={`${getDifficultyColor(option.difficulty)} border-0`}>
                    {option.difficulty}
                  </Badge>
                </div>
              </div>
              <CardDescription className="text-base">
                {option.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Commands */}
              <div>
                <h4 className="font-semibold mb-2">Kurulum Komutları:</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-md font-mono text-sm space-y-1">
                  {option.commands.map((command, cmdIndex) => (
                    <div key={cmdIndex} className="flex items-center justify-between group">
                      <span className={command.startsWith('#') ? 'text-gray-400' : ''}>
                        {command}
                      </span>
                      {!command.startsWith('#') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
                          onClick={() => copyToClipboard(command, `${option.name}-${cmdIndex}`)}
                        >
                          {copiedCommand === `${option.name}-${cmdIndex}` ? (
                            <span className="text-green-400">Kopyalandı!</span>
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pros & Cons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-semibold text-green-600 mb-2">✅ Avantajlar:</h5>
                  <ul className="text-sm space-y-1 text-gray-600">
                    {option.pros.map((pro, proIndex) => (
                      <li key={proIndex} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h5 className="font-semibold text-red-600 mb-2">❌ Dezavantajlar:</h5>
                  <ul className="text-sm space-y-1 text-gray-600">
                    {option.cons.map((con, conIndex) => (
                      <li key={conIndex} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        {con}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Resources */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ek Kaynaklar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Test Araçları:</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a 
                    href="/admin/tools/webhook-test" 
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Webhook Test Tool
                  </a>
                </li>
                <li>
                  <a 
                    href="/api/twilio/test-webhook" 
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                    target="_blank"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Test Webhook Endpoint
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Dokümantasyon:</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a 
                    href="https://ngrok.com/docs" 
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                    target="_blank"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ngrok Docs
                  </a>
                </li>
                <li>
                  <a 
                    href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/" 
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                    target="_blank"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Cloudflare Tunnel Docs
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 