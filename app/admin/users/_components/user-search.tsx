"use client";

import { useState, ChangeEvent } from "react";
import { Search } from "lucide-react";
import { Input } from "../../../../components/ui/input";

interface AgencyUserInfo {
  agency_id: string;
  user_id: string;
  role: string;
  agency_name: string;
}

interface UserProfile {
  id: string;
  username: string;
  role?: string;
  created_at: string | null;
  agencies?: AgencyUserInfo[];
}

interface UserSearchProps {
  users: UserProfile[];
}

export default function UserSearch({ users }: UserSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const filteredUsers = users.filter(user => {
    const lowercaseSearch = searchTerm.toLowerCase();
    
    // Kullanıcı adında ara
    if ((user.username || "").toLowerCase().includes(lowercaseSearch)) {
      return true;
    }
    
    // Ajans adında ara
    if (user.agencies && user.agencies.length > 0) {
      return user.agencies.some(agency => 
        agency.agency_name.toLowerCase().includes(lowercaseSearch)
      );
    }
    
    return false;
  });

  // Arama sonuçlarını özel bir event ile parent component'e gönder
  // Bu bileşen sadece arama UI'ı içeriyor, sonuçlar için parent sorumlu
  return (
    <div className="flex items-center mb-4">
      <Search className="w-4 h-4 mr-2 text-muted-foreground" />
      <Input
        placeholder="Kullanıcı veya ajans ara..."
        value={searchTerm}
        onChange={handleSearch}
        className="max-w-sm"
      />
      {/* Kullanıcıyı bilgilendirmek için arama sonucu sayısı */}
      {searchTerm.length > 0 && (
        <div className="ml-2 text-xs text-muted-foreground">
          {filteredUsers.length} sonuç bulundu
        </div>
      )}
    </div>
  );
} 