"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "../ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog"
import { deleteUserAction } from "../../lib/actions/user-actions" // Server action import edildi
import { toast } from "sonner"

interface DeleteUserButtonProps {
  userId: string
  userEmail?: string // Onay mesajında göstermek için
  onSuccess?: () => void // Silme başarılı olduğunda çağrılacak callback
  onError?: (error: string) => void // Silme başarısız olduğunda çağrılacak callback
}

export function DeleteUserButton({
  userId,
  userEmail,
  onSuccess,
  onError,
}: DeleteUserButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  async function handleDelete() {
    setIsLoading(true)
    try {
      const result = await deleteUserAction({ userId })

      if (result && result.serverError) {
        console.error("Server Action Error:", result.serverError)
        onError?.(typeof result.serverError === 'string' ? result.serverError : "Sunucu hatası oluştu.")
      } else if (result && result.validationErrors) {
        console.error("Validation Error:", result.validationErrors)
        onError?.("Geçersiz kullanıcı ID'si nedeniyle silme işlemi başarısız oldu.")
      } else if (result && result.data?.success) {
        onSuccess?.()
        setIsOpen(false) // Dialog'u kapat
      } else {
        console.error("Unexpected result from deleteUserAction:", result)
        const message = result?.data?.message || "Kullanıcı silinirken bilinmeyen bir hata oluştu."
        onError?.(message)
      }
    } catch (error: any) {
      console.error("Delete action failed (catch block):", error)
      onError?.(error.message || "İşlem sırasında bir istemci tarafı hatası oluştu.")
    }
    setIsLoading(false)
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-100 px-2">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kullanıcıyı Silmek İstediğinizden Emin misiniz?</AlertDialogTitle>
          <AlertDialogDescription>
            Bu işlem geri alınamaz. Kullanıcıyı kalıcı olarak sileceksiniz.
            {userEmail && ` Kullanıcı: ${userEmail}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>İptal</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
} 