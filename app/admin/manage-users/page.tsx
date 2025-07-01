"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../../components/ui/alert-dialog";
import { Loader2, Search, UserPlus, Edit, Trash2, Building } from "lucide-react";
import { getUsersListAction, updateUserRoleAction, deleteUserAction, assignUserToAgencyAction } from "../../actions/admin-actions";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  agency: { id: string; name: string } | null;
  agencyRole: string | null;
  createdAt: string;
}

interface Agency {
  id: string;
  name: string;
}

export default function ManageUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAgencyDialogOpen, setIsAgencyDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [selectedAgencyRole, setSelectedAgencyRole] = useState<string>("agency_member");
  const [actionLoading, setActionLoading] = useState(false);

  // Kullanıcıları yükle
  const loadUsers = async () => {
    setLoading(true);
    const result = await getUsersListAction({ page: 1, limit: 100 });
    
    if (result?.data?.success && result.data.users) {
      setUsers(result.data.users);
    } else if (result?.serverError || result?.data?.failure) {
      toast.error(result.serverError || result.data?.failure || "Kullanıcılar yüklenemedi");
    }
    
    setLoading(false);
  };

  // Ajansları yükle
  const loadAgencies = async () => {
    try {
      const response = await fetch("/api/agencies");
      if (response.ok) {
        const data = await response.json();
        setAgencies(data.agencies || []);
      }
    } catch (error) {
      console.error("Ajanslar yüklenemedi:", error);
    }
  };

  useEffect(() => {
    loadUsers();
    loadAgencies();
  }, []);

  // Kullanıcı rolünü güncelle
  const handleUpdateRole = async () => {
    if (!selectedUser || !selectedRole) return;
    
    setActionLoading(true);
    const result = await updateUserRoleAction({ 
      userId: selectedUser.id, 
      role: selectedRole as any 
    });
    
    if (result?.data?.success) {
      toast.success(result.data.success);
      await loadUsers();
      setIsEditDialogOpen(false);
    } else if (result?.serverError || result?.data?.failure) {
      toast.error(result.serverError || result.data?.failure || "Rol güncellenemedi");
    }
    
    setActionLoading(false);
  };

  // Kullanıcıyı sil
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    const result = await deleteUserAction({ userId: selectedUser.id });
    
    if (result?.data?.success) {
      toast.success(result.data.success);
      await loadUsers();
      setIsDeleteDialogOpen(false);
    } else if (result?.serverError || result?.data?.failure) {
      toast.error(result.serverError || result.data?.failure || "Kullanıcı silinemedi");
    }
    
    setActionLoading(false);
  };

  // Kullanıcıyı ajansa ata
  const handleAssignToAgency = async () => {
    if (!selectedUser || !selectedAgencyId) return;
    
    setActionLoading(true);
    const result = await assignUserToAgencyAction({ 
      userId: selectedUser.id, 
      agencyId: selectedAgencyId,
      role: selectedAgencyRole as any
    });
    
    if (result?.data?.success) {
      toast.success(result.data.success);
      await loadUsers();
      setIsAgencyDialogOpen(false);
    } else if (result?.serverError || result?.data?.failure) {
      toast.error(result.serverError || result.data?.failure || "Ajans ataması yapılamadı");
    }
    
    setActionLoading(false);
  };

  // Filtrelenmiş kullanıcılar
  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.agency?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Rol badge rengi
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "superuser":
        return "default";
      case "user":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Kullanıcı Yönetimi</CardTitle>
              <CardDescription>Sistem kullanıcılarını yönetin</CardDescription>
            </div>
            <Button onClick={() => router.push("/admin/ajans-ve-kullanici-olustur")}>
              <UserPlus className="h-4 w-4 mr-2" />
              Yeni Kullanıcı
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Arama */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="E-posta, kullanıcı adı veya ajans adı ile ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Kullanıcı Tablosu */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-posta</TableHead>
                <TableHead>Kullanıcı Adı</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Ajans</TableHead>
                <TableHead>Ajans Rolü</TableHead>
                <TableHead>Kayıt Tarihi</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.username || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.agency?.name || "-"}</TableCell>
                  <TableCell>
                    {user.agencyRole ? (
                      <Badge variant="outline">{user.agencyRole}</Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString("tr-TR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(user);
                          setSelectedRole(user.role);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(user);
                          setSelectedAgencyId(user.agency?.id || "");
                          setSelectedAgencyRole(user.agencyRole || "agency_member");
                          setIsAgencyDialogOpen(true);
                        }}
                      >
                        <Building className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              Kullanıcı bulunamadı
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rol Güncelleme Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcı Rolünü Güncelle</DialogTitle>
            <DialogDescription>
              {selectedUser?.email} kullanıcısının sistem rolünü güncelleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Rol seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="superuser">Superuser</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleUpdateRole} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajans Atama Dialog */}
      <Dialog open={isAgencyDialogOpen} onOpenChange={setIsAgencyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajans Ataması</DialogTitle>
            <DialogDescription>
              {selectedUser?.email} kullanıcısını bir ajansa atayın.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
              <SelectTrigger>
                <SelectValue placeholder="Ajans seçin" />
              </SelectTrigger>
              <SelectContent>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedAgencyRole} onValueChange={setSelectedAgencyRole}>
              <SelectTrigger>
                <SelectValue placeholder="Ajans rolü seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agency_admin">Ajans Admin</SelectItem>
                <SelectItem value="agency_member">Ajans Üyesi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAgencyDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleAssignToAgency} disabled={actionLoading || !selectedAgencyId}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silme Onay Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcı Silinecek</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser?.email} kullanıcısını silmek istediğinizden emin misiniz? 
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={handleDeleteUser}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}