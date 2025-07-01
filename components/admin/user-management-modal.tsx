"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createSimpleUser } from "@/lib/actions/simple-user-management";
import { assignUserRole } from "@/lib/actions/user-management-actions";

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    role: ""
  });

  const roleOptions = [
    { value: "user", label: "User (Kullanıcı)", color: "bg-gray-100" },
    { value: "agency_user", label: "Agency User (Ajans Kullanıcısı)", color: "bg-blue-100" },
    { value: "agency_admin", label: "Agency Admin (Ajans Yöneticisi)", color: "bg-blue-200" },
    { value: "admin", label: "Admin (Yönetici)", color: "bg-orange-100" },
    { value: "super_admin", label: "Super Admin (Süper Yönetici)", color: "bg-red-100" },
    { value: "superuser", label: "Superuser (Tam Yetkili)", color: "bg-red-200" }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.fullName || !formData.role) {
      toast.error("Tüm alanları doldurun");
      return;
    }

    console.log('👥 [USER-MODAL] Starting user creation...', formData);
    setIsLoading(true);
    try {
      console.log('📡 [USER-MODAL] Calling createSimpleUser...');
      const result = await createSimpleUser({
        email: formData.email,
        fullName: formData.fullName,
        role: formData.role as any
      });

      console.log('📊 [USER-MODAL] createSimpleUser result:', {
        hasResult: !!result,
        hasData: !!result?.data,
        success: result?.data?.success,
        error: result?.data?.error,
        serverError: result?.serverError,
        validationErrors: result?.validationErrors,
        fullResult: result
      });

      if (result?.data?.success) {
        console.log('✅ [USER-MODAL] User creation successful');
        toast.success(result.data.message);
        setFormData({ email: "", fullName: "", role: "" });
        onSuccess();
        onClose();
      } else {
        console.log('❌ [USER-MODAL] User creation failed');
        if (result?.serverError) {
          console.log('🚨 [USER-MODAL] Server error:', result.serverError);
        }
        toast.error(result?.data?.error || result?.serverError || 'Kullanıcı oluşturma hatası');
      }
    } catch (error) {
      console.error('💥 [USER-MODAL] Unexpected error:', error);
      toast.error('Kullanıcı oluşturma işlemi başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({ email: "", fullName: "", role: "" });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle>
          <DialogDescription>
            Sisteme yeni bir kullanıcı ekleyin. Tüm alanlar zorunludur.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-posta Adresi</Label>
            <Input
              id="email"
              type="email"
              placeholder="ornek@email.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Ad Soyad</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Ahmet Yılmaz"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Kullanıcı Rolü</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
              disabled={isLoading}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Bir rol seçin" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${option.color}`} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
            >
              İptal
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? "Oluşturuluyor..." : "Kullanıcı Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RoleAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
}

export function RoleAssignmentModal({ open, onClose, onSuccess, user }: RoleAssignmentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [reason, setReason] = useState("");

  const roleOptions = [
    { value: "user", label: "User (Kullanıcı)", color: "bg-gray-100" },
    { value: "agency_user", label: "Agency User (Ajans Kullanıcısı)", color: "bg-blue-100" },
    { value: "agency_admin", label: "Agency Admin (Ajans Yöneticisi)", color: "bg-blue-200" },
    { value: "admin", label: "Admin (Yönetici)", color: "bg-orange-100" },
    { value: "super_admin", label: "Super Admin (Süper Yönetici)", color: "bg-red-100" },
    { value: "superuser", label: "Superuser (Tam Yetkili)", color: "bg-red-200" }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newRole || !reason.trim() || reason.length < 10) {
      toast.error("Yeni rol seçin ve en az 10 karakter sebep yazın");
      return;
    }

    if (!user) return;

    setIsLoading(true);
    try {
      const result = await assignUserRole({ 
        userId: user.id, 
        role: newRole as any, 
        reason: reason.trim() 
      });

      if (result?.data?.success) {
        toast.success(result.data.message);
        setNewRole("");
        setReason("");
        onSuccess();
        onClose();
      } else {
        toast.error(result?.data?.error || 'Rol atama hatası');
      }
    } catch (error) {
      toast.error('Rol atama işlemi başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setNewRole("");
      setReason("");
      onClose();
    }
  };

  const currentRoleLabel = roleOptions.find(r => r.value === user?.role)?.label || user?.role;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Rol Değiştir</DialogTitle>
          <DialogDescription>
            {user?.full_name || user?.email} kullanıcısının rolünü değiştirin
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Mevcut Rol:</div>
            <div className="font-semibold">{currentRoleLabel}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newRole">Yeni Rol</Label>
            <Select 
              value={newRole} 
              onValueChange={setNewRole}
              disabled={isLoading}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Yeni rol seçin" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.filter(option => option.value !== user?.role).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${option.color}`} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Değişiklik Sebebi (minimum 10 karakter)</Label>
            <Textarea
              id="reason"
              placeholder="Rol değişikliğinin sebebini açıklayın..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              rows={3}
              required
              minLength={10}
            />
            <div className="text-xs text-gray-500">
              {reason.length}/10 karakter minimum
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
            >
              İptal
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || reason.length < 10}
              variant="destructive"
            >
              {isLoading ? "Değiştiriliyor..." : "Rolü Değiştir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}