import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui/table';
import { Button } from '../../../../components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../../hooks/use-toast';
import { deleteUser } from '../../../../lib/actions/user-actions';

interface User {
  id: string;
  email: string;
  role?: string;
  created_at?: string;
}

const USER_QUERY_KEY = 'users';

function UserTableRow({ user, onUserDeleted }: { user: User, onUserDeleted?: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const handleDelete = async () => {
    if (!confirm(`${user.email} kullanıcısını silmek istediğinizden emin misiniz?`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      console.log('Kullanıcı silme başlatılıyor:', user.id);
      
      const result = await deleteUser(user.id);
      const { error, success, message } = result as { 
        error?: string,
        success?: boolean,
        message?: string
      };
      
      console.log('Silme işlemi sonucu:', result);
      
      if (error) {
        console.error('Kullanıcı silme hatası:', error);
        toast({
          title: 'Hata',
          description: `Kullanıcı silinemedi: ${error}`,
          variant: 'destructive'
        });
        return;
      }
      
      if (success) {
        // UI'ı güncelle
        toast({
          title: 'Başarılı',
          description: message || 'Kullanıcı başarıyla silindi',
          variant: 'default'
        });
        
        // Optimistik UI güncellemesi
        queryClient.setQueryData([USER_QUERY_KEY], (old: User[] = []) => 
          old.filter(u => u.id !== user.id)
        );
        
        // Parent bileşeni bilgilendir
        if (onUserDeleted) onUserDeleted();
        
        // Sayfa yenilemesi için timeout ekle
        toast({
          title: 'Yenileniyor',
          description: 'Sayfa yenileniyor...',
          variant: 'default'
        });
        
        setTimeout(() => {
          window.location.href = window.location.pathname + '?t=' + Date.now();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Beklenmeyen hata:', err);
      toast({
        title: 'Hata',
        description: `Beklenmeyen bir hata oluştu: ${err?.message || 'Bilinmeyen hata'}`,
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TableRow>
      <TableCell>{user.email}</TableCell>
      <TableCell>{user.role || '-'}</TableCell>
      <TableCell>
        <Button 
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
          size="sm"
          aria-label="Kullanıcıyı sil"
        >
          {isDeleting ? 'Siliniyor...' : 'Sil'}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default UserTableRow;
