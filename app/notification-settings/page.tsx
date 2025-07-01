"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Input } from "../../components/ui/input";
import { clientNotificationService, NOTIFICATION_TYPES, NOTIFICATION_CHANNELS, ClientNotificationPreference, NotificationChannel } from "../../lib/services/client-notification-service";
import { PlusCircle, X } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

export default function NotificationSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<ClientNotificationPreference[]>([]);
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newEmailAddress, setNewEmailAddress] = useState("");
  const [activePreferenceEdit, setActivePreferenceEdit] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Sayfa yüklendiğinde bildirim tercihlerini getir
    async function loadPreferences() {
      try {
        setIsLoading(true);
        // Tüm bildirim tercihlerini getir
        const userPreferences = await clientNotificationService.getUserPreferences();
        
        // Varsayılan tipleri ve mevcut tercihleri birleştir
        const allPreferences: ClientNotificationPreference[] = [];
        
        // Her tip için tercihi ekle (yoksa varsayılan değerler ile)
        Object.values(NOTIFICATION_TYPES).forEach(type => {
          const existingPref = userPreferences.find(p => p.notification_type === type);
          
          if (existingPref) {
            allPreferences.push(existingPref);
          } else {
            // Tip için varsayılan tercih oluştur
            allPreferences.push({
              notification_type: type,
              notification_channel: NOTIFICATION_CHANNELS.EMAIL,
              phone_numbers: [],
              email_addresses: [],
              is_enabled: true
            });
          }
        });
        
        setPreferences(allPreferences);
      } catch (error) {
        console.error("Bildirim tercihleri yüklenemedi:", error);
        toast({
          title: "Hata",
          description: "Bildirim tercihleri yüklenirken bir sorun oluştu.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    loadPreferences();
  }, []);
  
  // Tercih güncelleme fonksiyonu
  const updatePreference = (index: number, updates: Partial<ClientNotificationPreference>) => {
    setPreferences(prev => {
      const newPrefs = [...prev];
      newPrefs[index] = { ...newPrefs[index], ...updates };
      return newPrefs;
    });
  };
  
  // Telefon numarası ekleme
  const addPhoneNumber = (index: number) => {
    if (!newPhoneNumber.trim()) return;
    
    const updatedPrefs = [...preferences];
    if (!updatedPrefs[index].phone_numbers.includes(newPhoneNumber.trim())) {
      updatedPrefs[index].phone_numbers.push(newPhoneNumber.trim());
      setPreferences(updatedPrefs);
    }
    setNewPhoneNumber("");
    setActivePreferenceEdit(null);
  };

  // E-posta adresi ekleme
  const addEmailAddress = (index: number) => {
    if (!newEmailAddress.trim()) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmailAddress.trim())) {
      toast({
        title: "Geçersiz E-posta",
        description: "Lütfen geçerli bir e-posta adresi girin.",
        variant: "destructive"
      });
      return;
    }
    
    const updatedPrefs = [...preferences];
    if (!updatedPrefs[index].email_addresses.includes(newEmailAddress.trim())) {
      updatedPrefs[index].email_addresses.push(newEmailAddress.trim());
      setPreferences(updatedPrefs);
    }
    setNewEmailAddress("");
    setActivePreferenceEdit(null);
  };
  
  // Telefon numarası çıkarma
  const removePhoneNumber = (prefIndex: number, phoneIndex: number) => {
    const updatedPrefs = [...preferences];
    updatedPrefs[prefIndex].phone_numbers.splice(phoneIndex, 1);
    setPreferences(updatedPrefs);
  };

  // E-posta adresi çıkarma
  const removeEmailAddress = (prefIndex: number, emailIndex: number) => {
    const updatedPrefs = [...preferences];
    updatedPrefs[prefIndex].email_addresses.splice(emailIndex, 1);
    setPreferences(updatedPrefs);
  };
  
  // Bildirim kanalını değiştir
  const changeNotificationChannel = (index: number, channel: NotificationChannel) => {
    updatePreference(index, {
      notification_channel: channel
    });
  };
  
  // Tüm değişiklikleri kaydetme
  const handleSaveChanges = async () => {
    setIsSaving(true);
    
    try {
      // Her tercihi sırayla kaydet
      for (const preference of preferences) {
        await clientNotificationService.savePreference(preference);
      }
      
      toast({
        title: "Başarılı",
        description: "Bildirim tercihleri kaydedildi.",
      });
    } catch (error) {
      console.error("Bildirim tercihleri kaydedilemedi:", error);
      toast({
        title: "Hata",
        description: "Bildirim tercihleri kaydedilirken bir sorun oluştu.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Bildirim tipinin insan tarafından okunabilir versiyonunu döndür
  const getNotificationTypeLabel = (type: string): string => {
    switch (type) {
      case NOTIFICATION_TYPES.TRANSFER_DEADLINE:
        return "Son Teslim Tarihi Yaklaştığında";
      case NOTIFICATION_TYPES.STATUS_CHANGED:
        return "Transfer Durumu Değiştiğinde";
      case NOTIFICATION_TYPES.TRANSFER_ASSIGNED:
        return "Yeni Transfer Atandığında";
      default:
        return type;
    }
  };
  
  // Bildirim tipinin açıklamasını döndür
  const getNotificationTypeDescription = (type: string): string => {
    switch (type) {
      case NOTIFICATION_TYPES.TRANSFER_DEADLINE:
        return "Bir transferin son teslim tarihi yaklaştığında bildirim alırsınız";
      case NOTIFICATION_TYPES.STATUS_CHANGED:
        return "Bir transferin durumu değiştiğinde bildirim alırsınız";
      case NOTIFICATION_TYPES.TRANSFER_ASSIGNED:
        return "Size yeni bir transfer atandığında bildirim alırsınız";
      default:
        return "Bu bildirimin ayarlarını yönetin";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex justify-center">
        <p>Bildirim tercihleri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Bildirim Ayarları</h1>
        <p className="text-muted-foreground">
          Hangi durumlarda bildirim almak istediğinizi buradan yönetebilirsiniz.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bildirim Tercihleri</CardTitle>
          <CardDescription>
            Bildirimleri nasıl almak istediğinizi seçin. Telefon bildirimleri için, aranmak istediğiniz numaraları ekleyin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {preferences.map((preference, index) => (
            <div key={preference.notification_type} className="space-y-4 p-4 rounded-md border">
              <div className="flex items-center justify-between">
                <Label htmlFor={`notify-${preference.notification_type}`} className="flex flex-col space-y-1">
                  <span>{getNotificationTypeLabel(preference.notification_type)}</span>
                  <span className="font-normal leading-snug text-muted-foreground">
                    {getNotificationTypeDescription(preference.notification_type)}
                  </span>
                </Label>
                <Switch 
                  id={`notify-${preference.notification_type}`} 
                  checked={preference.is_enabled}
                  onCheckedChange={(value: boolean) => 
                    updatePreference(index, { is_enabled: value })
                  }
                  disabled={isSaving}
                />
              </div>
              
              {preference.is_enabled && (
                <div className="pt-3 border-t space-y-4">
                  {/* Bildirim kanalı seçimi */}
                  <div>
                    <Label htmlFor={`channel-${preference.notification_type}`} className="mb-2 block">
                      Bildirim kanalı
                    </Label>
                    <Select 
                      value={preference.notification_channel} 
                      onValueChange={(value) => changeNotificationChannel(index, value as NotificationChannel)}
                      disabled={isSaving}
                    >
                      <SelectTrigger id={`channel-${preference.notification_type}`} className="w-full">
                        <SelectValue placeholder="Bildirim kanalı seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NOTIFICATION_CHANNELS.CALL}>Sesli Arama</SelectItem>
                        <SelectItem value={NOTIFICATION_CHANNELS.EMAIL}>E-posta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Telefon numaraları / E-posta adresleri */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      {preference.notification_channel === NOTIFICATION_CHANNELS.CALL 
                        ? "Aranmak istediğiniz telefon numaraları" 
                        : "E-posta gönderilmek istediğiniz adresler"}
                    </h4>
                    
                    {/* Telefon numaraları listesi */}
                    {preference.notification_channel === NOTIFICATION_CHANNELS.CALL && (
                      <>
                        {preference.phone_numbers.length > 0 ? (
                          <div className="space-y-2 mb-3">
                            {preference.phone_numbers.map((phone, phoneIndex) => (
                              <div key={phoneIndex} className="flex items-center gap-2">
                                <div className="bg-muted px-3 py-1 rounded-md text-sm flex-1">
                                  {phone}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePhoneNumber(index, phoneIndex)}
                                  disabled={isSaving}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground mb-3">
                            Telefon numarası eklenmemiş
                          </p>
                        )}
                        
                        {activePreferenceEdit === preference.notification_type ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="tel"
                              placeholder="+90XXXXXXXXXX"
                              value={newPhoneNumber}
                              onChange={(e) => setNewPhoneNumber(e.target.value)}
                              className="flex-1"
                            />
                            <Button 
                              type="button"
                              variant="secondary"
                              onClick={() => addPhoneNumber(index)}
                              disabled={isSaving || !newPhoneNumber.trim()}
                            >
                              Ekle
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setActivePreferenceEdit(preference.notification_type)}
                            disabled={isSaving}
                            className="flex items-center gap-1"
                          >
                            <PlusCircle className="h-4 w-4" />
                            <span>Numara Ekle</span>
                          </Button>
                        )}
                      </>
                    )}
                    
                    {/* E-posta adresleri listesi */}
                    {preference.notification_channel === NOTIFICATION_CHANNELS.EMAIL && (
                      <>
                        {preference.email_addresses.length > 0 ? (
                          <div className="space-y-2 mb-3">
                            {preference.email_addresses.map((email, emailIndex) => (
                              <div key={emailIndex} className="flex items-center gap-2">
                                <div className="bg-muted px-3 py-1 rounded-md text-sm flex-1">
                                  {email}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeEmailAddress(index, emailIndex)}
                                  disabled={isSaving}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground mb-3">
                            E-posta adresi eklenmemiş
                          </p>
                        )}
                        
                        {activePreferenceEdit === preference.notification_type ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="email"
                              placeholder="ornek@email.com"
                              value={newEmailAddress}
                              onChange={(e) => setNewEmailAddress(e.target.value)}
                              className="flex-1"
                            />
                            <Button 
                              type="button"
                              variant="secondary"
                              onClick={() => addEmailAddress(index)}
                              disabled={isSaving || !newEmailAddress.trim()}
                            >
                              Ekle
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setActivePreferenceEdit(preference.notification_type)}
                            disabled={isSaving}
                            className="flex items-center gap-1"
                          >
                            <PlusCircle className="h-4 w-4" />
                            <span>E-posta Ekle</span>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveChanges} disabled={isSaving}>
          {isSaving ? "Kaydediliyor..." : "Ayarları Kaydet"}
        </Button>
      </div>
    </div>
  );
} 