"use client"

import { useEffect, useState } from "react"
import { createClient } from "../../../../../../lib/supabase/client"
import { Button } from "../../../../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../../../components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../../components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../../../../components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../../components/ui/select"
import { Label } from "../../../../../../components/ui/label"
import { toast } from "sonner"
import { Database } from "../../../../../../types/supabase"
import { assignUserToAgency, hardDeleteUserFromAgency, removeUserFromAgency, updateAgencyUserRole } from "../../../../../../lib/actions/agency-actions"

interface AgencyUsersProps {
  agencyId: string
}

interface AgencyUser {
  user_id: string
  role: Database["public"]["Enums"]["agency_role"]
  username?: string
}

interface AvailableUser {
  id: string
  username: string
  email?: string
}

export default function AgencyUsers({ agencyId }: AgencyUsersProps) {
  const [users, setUsers] = useState<AgencyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [selectedRole, setSelectedRole] = useState<Database["public"]["Enums"]["agency_role"]>("agency_member")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AgencyUser | null>(null)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [userToRemove, setUserToRemove] = useState<AgencyUser | null>(null)
  
  const supabase = createClient()
  
  // Ajans kullanıcılarını getir
  useEffect(() => {
    async function fetchAgencyUsers() {
      try {
        setLoading(true)
        
        // Önce agency_users tablosundan ajansa atanmış kullanıcıları getir
        const { data: agencyUsers, error: agencyUsersError } = await supabase
          .from('agency_users')
          .select('user_id, role')
          .eq('agency_id', agencyId)
        
        if (agencyUsersError) {
          console.error('Ajans kullanıcıları getirilemedi:', agencyUsersError)
          toast.error('Kullanıcı verileri yüklenirken bir hata oluştu')
          return
        }

        if (!agencyUsers || agencyUsers.length === 0) {
          setUsers([])
          setLoading(false)
          return
        }
        
        // Kullanıcı ID'lerini bir diziye çıkart
        const userIds = agencyUsers.map(user => user.user_id)
        
        // Kullanıcı profillerini getir
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', userIds)
        
        if (profilesError) {
          console.error('Kullanıcı profilleri getirilemedi:', profilesError)
          // Hata olursa profil bilgileri olmadan devam et
        }
        
        // Kullanıcı verilerini profil bilgileriyle birleştir
        const usersWithProfiles = agencyUsers.map(user => {
          const profile = profiles?.find(p => p.id === user.user_id)
          return {
            user_id: user.user_id,
            role: user.role,
            username: profile?.username
          }
        })
        
        setUsers(usersWithProfiles)
      } catch (error) {
        console.error('Ajans kullanıcıları getirirken hata:', error)
        toast.error('Kullanıcı verisi çekilirken bir hata oluştu')
      } finally {
        setLoading(false)
      }
    }
    
    fetchAgencyUsers()
  }, [agencyId, supabase])

  // Atanabilecek kullanıcıları getir
  async function fetchAvailableUsers() {
    try {
      // Mevcut ajans kullanıcılarının ID'lerini al
      const existingUserIds = users.map(user => user.user_id)
      
      // Tüm kullanıcı profillerini getir (mevcut kullanıcılar hariç)
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('id, username')
      
      if (error) {
        console.error('Kullanıcı profilleri getirilemedi:', error)
        toast.error('Kullanıcı listesi yüklenirken bir hata oluştu')
        return []
      }
      
      // Mevcut ajans kullanıcılarını hariç tut
      const availableUsers = profiles
        ?.filter(profile => !existingUserIds.includes(profile.id))
        .map(profile => ({
          id: profile.id,
          username: profile.username
        })) || []
      
      setAvailableUsers(availableUsers)
      
      // İlk kullanıcıyı otomatik seç (eğer varsa)
      if (availableUsers.length > 0) {
        setSelectedUserId(availableUsers[0].id)
      }
      
      return availableUsers
    } catch (error) {
      console.error('Kullanıcı listesi alınırken hata:', error)
      toast.error('Kullanıcı listesi yüklenirken bir hata oluştu')
      return []
    }
  }
  
  // Dialog açıldığında kullanıcıları getir
  const handleOpenDialog = async () => {
    await fetchAvailableUsers()
    setIsDialogOpen(true)
  }
  
  // Kullanıcı ekle
  const handleAddUser = async () => {
    if (!selectedUserId || !selectedRole) {
      toast.error('Lütfen bir kullanıcı ve rol seçin')
      return
    }
    
    try {
      setIsSubmitting(true)
      
      // Server action kullanarak kullanıcıyı ajansa ekle
      const result = await assignUserToAgency({
        agencyId,
        userId: selectedUserId,
        role: selectedRole
      })
      
      if (result?.serverError) {
        toast.error(`Kullanıcı eklenirken hata: ${result.serverError}`)
        return
      }
      
      toast.success('Kullanıcı ajansa başarıyla eklendi')
      
      // Modal'ı kapat ve kullanıcı listesini yenile
      setIsDialogOpen(false)
      
      // Yeni eklenen kullanıcının profil bilgilerini getir
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', selectedUserId)
        .single()
      
      if (profileError) {
        console.error('Kullanıcı profili getirilemedi:', profileError)
      }
        
      // Kullanıcı listesini güncelle
      const newUser = {
        user_id: selectedUserId,
        role: selectedRole,
        username: profile?.username
      }
      
      setUsers([...users, newUser])
      
    } catch (error: any) {
      console.error('Kullanıcı eklenirken hata:', error)
      toast.error(`Kullanıcı eklenirken bir hata oluştu: ${error?.message || 'Bilinmeyen hata'}`)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Kullanıcı rolünü güncelleme
  const handleUpdateRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast.error('Rol seçimi gerekli')
      return
    }
    
    try {
      setIsSubmitting(true)
      
      // Server action kullanarak kullanıcı rolünü güncelle
      const result = await updateAgencyUserRole({
        agencyId,
        userId: selectedUser.user_id,
        newRole: selectedRole
      })
      
      if (result?.serverError) {
        toast.error(`Rol güncellenirken hata: ${result.serverError}`)
        return
      }
      
      toast.success('Kullanıcı rolü başarıyla güncellendi')
      
      // Modal'ı kapat
      setIsRoleDialogOpen(false)
      
      // Kullanıcı listesini güncelle
      setUsers(prev => 
        prev.map(user => 
          user.user_id === selectedUser.user_id 
            ? { ...user, role: selectedRole } 
            : user
        )
      )
      
    } catch (error: any) {
      console.error('Rol güncellenirken hata:', error)
      toast.error(`Rol güncellenirken bir hata oluştu: ${error?.message || 'Bilinmeyen hata'}`)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Kullanıcı rolünü değiştirme dialogunu aç
  const handleOpenRoleDialog = (user: AgencyUser) => {
    setSelectedUser(user)
    setSelectedRole(user.role)
    setIsRoleDialogOpen(true)
  }
  
  // Kullanıcı silme
  const handleRemoveUser = async () => {
    if (!userToRemove) {
      toast.error('Silinecek kullanıcı seçilmedi')
      return
    }
    
    try {
      setIsSubmitting(true)
      
      // hardDeleteUserFromAgency server action kullanarak kullanıcıyı ajanstan çıkar
      console.log('Kullanıcı silme başlatılıyor (hardDelete):', userToRemove.user_id)
      
      const result = await hardDeleteUserFromAgency({
        agencyId,
        userId: userToRemove.user_id
      })
      
      console.log('Silme işlemi sonucu (hardDelete):', result)
      
      if (result?.serverError) {
        toast.error(`Kullanıcı silinirken hata: ${result.serverError}`)
        return
      }
      
      toast.success('Kullanıcı ajanstan başarıyla çıkarıldı')
      
      // Modal'ı kapat
      setIsRemoveDialogOpen(false)
      
      // Kullanıcı listesini güncelle
      setUsers(prev => prev.filter(user => user.user_id !== userToRemove.user_id))
      
      // Supabase'den doğrudan veriyi tekrar çek (önbelleği zorla temizle)
      const { data: refreshCheck } = await supabase
        .from('agency_users')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('user_id', userToRemove.user_id);
        
      // Eğer hala veri varsa loglama yap
      if (refreshCheck && refreshCheck.length > 0) {
        console.error('Silme işlemi sonrasında veri hala mevcut:', refreshCheck);
        
        // Sayfayı tam yenile - sorun devam ediyorsa
        setTimeout(() => window.location.reload(), 1000);
      }
      
    } catch (error: any) {
      console.error('Kullanıcı silinirken hata:', error)
      toast.error(`Kullanıcı silinirken bir hata oluştu: ${error?.message || 'Bilinmeyen hata'}`)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Kullanıcı silme dialogunu aç
  const handleOpenRemoveDialog = (user: AgencyUser) => {
    setUserToRemove(user)
    setIsRemoveDialogOpen(true)
  }
  
  // Kullanıcı rolünü göstermek için yardımcı fonksiyon
  function getRoleBadge(role: Database["public"]["Enums"]["agency_role"]) {
    switch (role) {
      case 'agency_admin':
        return <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">Ajans Yöneticisi</span>
      case 'agency_member':
        return <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">Ajans Üyesi</span>
      default:
        return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">{role}</span>
    }
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Ajans Kullanıcıları</CardTitle>
          <CardDescription>Bu ajansa atanmış kullanıcıları yönetin</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={handleOpenDialog}>Kullanıcı Ekle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajansa Kullanıcı Ekle</DialogTitle>
              <DialogDescription>
                Ajansa eklemek istediğiniz kullanıcıyı ve rolünü seçin.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="user">Kullanıcı</Label>
                {availableUsers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Eklenebilecek kullanıcı bulunamadı.
                  </div>
                ) : (
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kullanıcı seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={selectedRole} onValueChange={(value: Database["public"]["Enums"]["agency_role"]) => setSelectedRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Rol seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agency_admin">Ajans Yöneticisi</SelectItem>
                    <SelectItem value="agency_member">Ajans Üyesi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                İptal
              </Button>
              <Button 
                onClick={handleAddUser}
                disabled={isSubmitting || availableUsers.length === 0}
              >
                {isSubmitting ? "Ekleniyor..." : "Ekle"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      {/* Role Update Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcı Rolünü Değiştir</DialogTitle>
            <DialogDescription>
              {selectedUser?.username || selectedUser?.user_id} kullanıcısının rolünü değiştirin.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="role">Yeni Rol</Label>
              <Select 
                value={selectedRole} 
                onValueChange={(value: any) => setSelectedRole(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rol seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency_admin">Ajans Yöneticisi</SelectItem>
                  <SelectItem value="agency_member">Ajans Üyesi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsRoleDialogOpen(false)}
              disabled={isSubmitting}
            >
              İptal
            </Button>
            <Button 
              onClick={handleUpdateRole}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Güncelleniyor..." : "Güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Remove User Dialog */}
      <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcıyı Çıkar</DialogTitle>
            <DialogDescription>
              <strong>{userToRemove?.username || userToRemove?.user_id}</strong> kullanıcısını ajans üyeliğinden çıkarmak istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsRemoveDialogOpen(false)}
              disabled={isSubmitting}
            >
              İptal
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRemoveUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Siliniyor..." : "Kullanıcıyı Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Kullanıcılar yükleniyor...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            Bu ajansa henüz kullanıcı atanmamış
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium">
                    {user.username || user.user_id}
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mr-2"
                      onClick={() => handleOpenRoleDialog(user)}
                    >
                      Rolü Değiştir
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleOpenRemoveDialog(user)}
                    >
                      Kaldır
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
} 