import { z } from "zod";
// ../../types/supabase olabilir veya database.types projenin kökünde olabilir.
// Şimdilik ../database.types varsayıyorum, gerekirse düzeltilir.

// --- Ajans Oluşturma Şeması ---
export const CreateAgencySchema = z.object({
  name: z.string().min(3, "Ajans adı en az 3 karakter olmalı."),
});

// --- Ajans Detayları Şeması ve Tipi ---
export const GetAgencyDetailsSchema = z.object({
  agencyId: z.string().uuid("Geçersiz ajans ID formatı."),
});

// Bu tip doğrudan action içinde de kalabilir veya buradan export edilebilir.
// Şimdilik burada bırakıyorum.
export type AgencyDetailsData = { // İsim değişikliği: AgencyDetails -> AgencyDetailsData (action içindekiyle karışmasın)
  id: string;
  name: string;
  created_at: string;
  users: { // agency_users -> users (action'daki formattedData'ya uygun)
    id: string;
    email: string | null;
    role: string;
    assigned_at: string;
  }[];
};

// --- Kullanıcıyı Ajansa Atama Şeması ---
// Not: enum değerleri agency_role enum'u ile tutarlı olmalı.
// types/supabase.ts içinde agency_role: "agency_admin" | "agency_member" olarak güncellenmişti.
export const AssignUserSchema = z.object({
  agencyId: z.string().uuid("Geçersiz ajans ID formatı."),
  userId: z.string().uuid("Geçersiz kullanıcı ID formatı."),
  role: z.enum(["agency_admin", "agency_member"]).default("agency_member"), // ENUM GÜNCELLENDİ
});

// --- Kullanıcıyı Ajanstan Çıkarma Şeması ---
export const RemoveUserSchema = z.object({
  agencyId: z.string().uuid("Geçersiz ajans ID formatı."),
  userId: z.string().uuid("Geçersiz kullanıcı ID formatı."),
});

// --- Atanabilecek Kullanıcıları Getirme (Giriş Şeması Yok, Zod.undefined()) ---
// Bu action için özel bir giriş şeması yoktu, bu yüzden buraya eklemiyorum.

// --- Transferler için tipler (transfer-actions.ts'den) ---
// Eğer bu tipler sadece transfer-actions.ts içinde kullanılıyorsa burada olmasına gerek yok.
// Ancak genel kullanıma açıksa buraya taşınabilir. Şimdilik transfer-actions.ts'de bırakıyorum.
// export type TransferWithAgencyDetails = Omit<Tables<"transfers">, "assigned_agency_id"> & {
//   assigned_agency_id: {
//     id: string
//     name: string
//   } | null
// }
// export const CreateTransferSchema = z.object({ ... });
// export const GetTransfersForOfficerSchema = z.object({ ... });

// Not: ../database.types import yolunu kontrol et. Eğer projenin kök dizininde
// types/supabase.ts varsa ve bu dosya lib/types/supabase.ts değilse,
// import type { Database } from "../../types/supabase"; şeklinde olmalı.
// Şimdilik en son düzeltilen yola göre ../../types/supabase varsayıyorum.
// Eğer hata verirse bu yol düzeltilecek.
// Tekrar kontrol: Bir önceki adımdaki logda ../database.types olarak görünüyordu.
// Önceki başarılı düzeltme: import { type TablesInsert, type Tables } from "../../types/supabase"
// Bu durumda:
// import type { Database } from "../../types/supabase"; olmalı.

// DÜZELTİLMİŞ DATABASE İMPORTU
// Bunun yerine Tables ve TablesInsert'i import edelim, Database'e direkt ihtiyacımız olmayabilir.
import { type Tables, type TablesInsert } from "../../types/supabase";

// GetAgencyDetails için kullanılan AgencyDetails tipi action içindeki formatlamaya göre güncellendi
// ve TransferWithAgencyDetails gibi Omit kullanılarak daha sağlam hale getirilebilir.
// Şimdilik bu haliyle bırakıyorum, gerekirse iyileştirilir. 