"use client"

import { useEffect, useState } from "react"
import { getTransfersForOfficer, type TransferWithAgencyDetails } from "../../../lib/actions/transfer-actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
import { Badge } from "../../../components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert"
import { Loader2 } from "lucide-react"
import { format } from 'date-fns';

export default function OfficerTransfersDashboard() {
  const [transfers, setTransfers] = useState<TransferWithAgencyDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTransfers() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await getTransfersForOfficer({})

        if (result?.serverError) {
          setError(result.serverError)
        } else if (result?.validationErrors) {
          const errorMessages = Object.values(result.validationErrors).flat().join(", ")
          setError(errorMessages)
        } else if (result?.data?.success && result.data.data) {
          setTransfers(result.data.data || [])
        } else {
          setError("Transferler yüklenirken bilinmeyen bir hata oluştu.")
        }
      } catch (e: any) {
        setError(e.message || "Beklenmedik bir sunucu hatası.")
      }
      setIsLoading(false)
    }
    fetchTransfers()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-lg">Transferler yükleniyor...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertTitle>Hata!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Size Atanmış Transferler</h1>
      {transfers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Transfer Bulunamadı</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Şu anda size atanmış aktif bir transfer bulunmamaktadır.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Transfer Listesi</CardTitle>
            <CardDescription>
              Aşağıda size atanmış olan transferlerin listesi bulunmaktadır.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Başlık</TableHead>
                  <TableHead>Ajans</TableHead>
                  <TableHead>Son Teslim Tarihi</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Notlar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-medium">{transfer.title || "N/A"}</TableCell>
                    <TableCell>{transfer.assigned_agency_id?.name || "Belirtilmemiş"}</TableCell>
                    <TableCell>
                      {transfer.deadline ? format(new Date(transfer.deadline), 'dd/MM/yyyy HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={transfer.status === 'completed' ? 'default' : 'secondary'}>
                        {transfer.status || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>{transfer.notes || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 