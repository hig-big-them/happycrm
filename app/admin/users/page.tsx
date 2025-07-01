"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, UserIcon, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { toast } from "sonner";
import UserSearch from "./_components/user-search";
import { createClient } from "../../../lib/supabase/client";
import { deleteUser } from "../../../lib/actions/user-actions";

// Kullanıcı ajanstan çıkarma işlemi için
import { removeUserFromAgency } from "../../../lib/actions/agency-actions";

interface UserProfile {
  id: string;
  username: string;
  role: string;
  created_at: string | null;
  updated_at: string | null;
}

interface AgencyUserInfo {
  agency_id: string;
  user_id: string;
  role: string;
  agency_name: string;
}

interface UserWithAgencies extends UserProfile {
  agencies: AgencyUserInfo[];
}

export default function UsersList() {
  const router = useRouter();
  const [users, setUsers] = useState<UserWithAgencies[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  
  const supabase = createClient();

  // Kullanıcıları ve ajans ilişkilerini yükle
  const loadUsers = async () => {
    try {
      console.log('👥 [USER-MGMT] Starting to load users...');
      setIsLoading(true);
      setError(null);
      
      // Kullanıcı profillerini getir
      console.log('📊 [USER-MGMT] Fetching user profiles...');
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*');
      
      console.log('📋 [USER-MGMT] User profiles result:', {
        profilesCount: profiles?.length,
        hasError: !!profilesError,
        error: profilesError?.message
      });
      
      if (profilesError) throw profilesError;
      
      // Kullanıcıların ajans ilişkilerini getir
      const { data: agencyUsers, error: agencyError } = await supabase
        .from('agency_users')
        .select(`
          agency_id,
          user_id,
          role,
          agencies (
            id,
            name
          )
        `);
      
      if (agencyError) throw agencyError;
      
      // Kullanıcı ve ajans bilgilerini birleştir
      const enhancedUsers = profiles?.map(profile => {
        // Bu kullanıcıya ait ajans ilişkilerini bul
        const userAgencies = agencyUsers
          ?.filter(au => au.user_id === profile.id)
          .map(au => ({
            agency_id: au.agency_id,
            user_id: au.user_id,
            role: au.role,
            agency_name: au.agencies?.name || 'Bilinmeyen Ajans'
          })) || [];
        
        return {
          ...profile,
          agencies: userAgencies
        };
      });
      
      setUsers(enhancedUsers || []);
      setError(null);
    } catch (error: any) {
      console.error('Kullanıcılar yüklenirken hata:', error);
      setError('Kullanıcı verileri yüklenemedi');
      toast.error('Kullanıcı verileri yüklenemedi: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Kullanıcının bir ajanstan çıkarılması
  const handleRemoveFromAgency = async (userId: string, agencyId: string) => {
    try {
      setProcessingUser(userId);
      
      const result = await removeUserFromAgency({
        agencyId,
        userId
      });
      
      if (result.serverError) {
        toast.error(`Kullanıcı ajanstan çıkarılamadı: ${result.serverError}`);
        return;
      }
      
      toast.success('Kullanıcı ajanstan başarıyla çıkarıldı');
      
      // UI'ı güncelle
      setUsers(currentUsers => 
        currentUsers.map(user => {
          if (user.id === userId) {
            return {
              ...user,
              agencies: user.agencies.filter(a => a.agency_id !== agencyId)
            };
          }
          return user;
        })
      );
      
      // Kullanıcı listesini yenile
      loadUsers();
      
    } catch (error: any) {
      console.error('Kullanıcı ajanstan çıkarılırken hata:', error);
      toast.error('İşlem sırasında bir hata oluştu');
    } finally {
      setProcessingUser(null);
    }
  };

  const handleDelete = async (userId: string) => {
    const { error } = await deleteUser(userId);
    if (!error) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      // Ek önbellek temizleme
      await supabase.auth.refreshSession();
    }
  };

  useEffect(() => {
    async function checkAuthAndLoadUsers() {
      try {
        console.log('🔐 [USER-MGMT] Starting auth check and user loading...');
        
        // Oturum ve yetki kontrolü
        const { data: { session } } = await supabase.auth.getSession();
        
        console.log('📋 [USER-MGMT] Session check:', {
          hasSession: !!session,
          userRole: session?.user?.app_metadata?.role,
          userId: session?.user?.id
        });
        
        if (!session) {
          console.log('❌ [USER-MGMT] No session, redirecting to login');
          router.push('/login');
          return;
        }
        
        // Super admin veya superuser rolü erişebilir
        const userRole = session.user.app_metadata?.role;
        if (userRole !== 'superuser' && userRole !== 'super_admin') {
          console.log('🚫 [USER-MGMT] Not authorized role, redirecting to dashboard', { userRole });
          router.push('/dashboard');
          return;
        }

        console.log('✅ [USER-MGMT] Auth check passed, loading users...');
        // Kullanıcıları yükle
        await loadUsers();
        
      } catch (error: any) {
        console.error('💥 [USER-MGMT] Auth check error:', error);
        setError('Oturum kontrolü sırasında bir hata oluştu');
      }
    }
    
    checkAuthAndLoadUsers();
    
    // Realtime aboneliği ile değişiklikleri takip et
    const channel = supabase
      .channel('agency_users_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agency_users' 
      }, () => {
        console.log('Ajans kullanıcılarında değişiklik algılandı, veriler yenileniyor...');
        loadUsers();
      })
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Kullanıcı Yönetimi</h1>
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="h-4 w-4 mr-2" /> Yeni Kullanıcı
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tüm Kullanıcılar</CardTitle>
          <CardDescription>
            Sistem kullanıcılarını görüntüleyin ve yönetin. Yeni kullanıcı eklemek için sağ üstteki butonu kullanabilirsiniz.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="mb-4">
            <Button onClick={() => loadUsers()} variant="outline" size="sm">
              <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Listeyi Yenile
            </Button>
          </div>
          
          {/* Client component olarak arama işlevini kullanıyoruz */}
          <UserSearch users={users} />
          
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded mb-4">
              {error}
            </div>
          )}
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Ajanslar</TableHead>
                  <TableHead>Kayıt Tarihi</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Kullanıcı bulunamadı
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                          <div>{user.username || "Kullanıcı adı yok"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'superuser' ? 'default' : 'secondary'}>
                          {user.role === 'superuser' ? 'Yönetici' : 'Ajans'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.agencies?.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {user.agencies.map((agency) => (
                              <div key={agency.agency_id} className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs">
                                  {agency.agency_name}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-destructive"
                                  disabled={processingUser === user.id}
                                  onClick={() => handleRemoveFromAgency(user.id, agency.agency_id)}
                                  title="Bu ajanstan çıkar"
                                >
                                  {processingUser === user.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Ajans üyeliği yok</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('tr-TR') : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive" 
                          onClick={async () => {
                            if (confirm(`"${user.username}" kullanıcısını silmek istediğinize emin misiniz?`)) {
                              try {
                                await handleDelete(user.id);
                              } catch (error: any) {
                                console.error('Kullanıcı silinirken hata:', error);
                                setError('Kullanıcı silinirken bir hata oluştu');
                                toast.error('Kullanıcı silinemedi');
                              }
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}