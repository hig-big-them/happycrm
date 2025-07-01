"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle, Clock, MapPin, Calendar, User } from "lucide-react";
import { markPatientReceived } from "@/lib/actions/agency-transfer-actions";
import { formatDateTime } from "@/lib/utils/date";
import CountdownTimer from "@/components/countdown-timer";

interface Transfer {
  id: string;
  title: string;
  patient_name: string;
  transfer_datetime: string;
  deadline_datetime: string;
  status: string;
  priority: number;
  airport?: string;
  clinic?: string;
  notes?: string;
  routes?: { id: string; name: string };
  location_from?: { id: string; name: string };
  location_to?: { id: string; name: string };
  assigned_officer?: { id: string; username: string };
}

interface TransferStatusCardProps {
  transfer: Transfer;
  onStatusUpdate?: (transferId: string, newStatus: string) => void;
}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  driver_assigned: "bg-blue-100 text-blue-800",
  patient_picked_up: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  delayed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600"
};

const statusLabels = {
  pending: "Beklemede",
  driver_assigned: "Sürücü Atandı",
  patient_picked_up: "Hasta Alındı",
  completed: "Tamamlandı",
  delayed: "Gecikti",
  cancelled: "İptal Edildi"
};

export function TransferStatusCard({ transfer, onStatusUpdate }: TransferStatusCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const canMarkAsReceived = 
    transfer.status !== 'patient_picked_up' && 
    transfer.status !== 'completed' && 
    transfer.status !== 'cancelled';

  const handlePatientReceived = async () => {
    setIsUpdating(true);
    try {
      const result = await markPatientReceived({ transferId: transfer.id });
      
      if (result?.success) {
        toast.success(result.message || "Transfer başarıyla kapatıldı");
        if (onStatusUpdate) {
          onStatusUpdate(transfer.id, 'patient_picked_up');
        }
      } else {
        toast.error(result?.error || "Hata oluştu");
      }
    } catch (error) {
      console.error('Mark patient received error:', error);
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setIsUpdating(false);
    }
  };

  // Calculate if deadline is approaching or passed
  const now = new Date();
  const deadline = new Date(transfer.deadline_datetime);
  const isOverdue = now > deadline && canMarkAsReceived;
  const isApproaching = (deadline.getTime() - now.getTime()) < 30 * 60 * 1000 && canMarkAsReceived; // 30 minutes

  return (
    <Card className={`w-full ${isOverdue ? 'border-red-500 shadow-lg' : isApproaching ? 'border-orange-400' : ''}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-lg">{transfer.patient_name}</CardTitle>
            <p className="text-sm text-muted-foreground">{transfer.title}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={statusColors[transfer.status as keyof typeof statusColors] || ''}>
              {statusLabels[transfer.status as keyof typeof statusLabels] || transfer.status}
            </Badge>
            {transfer.priority > 5 && (
              <Badge variant="destructive">Yüksek Öncelik</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Transfer Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {/* Route Info */}
          {transfer.routes && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Rota:</span>
              <span>{transfer.routes.name}</span>
            </div>
          )}
          
          {/* Transfer Time */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Transfer:</span>
            <span>{formatDateTime(transfer.transfer_datetime)}</span>
          </div>
          
          {/* From Location */}
          {transfer.location_from && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Nereden:</span>
              <span>{transfer.location_from.name}</span>
            </div>
          )}
          
          {/* To Location */}
          {transfer.location_to && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Nereye:</span>
              <span>{transfer.location_to.name}</span>
            </div>
          )}
          
          {/* Assigned Officer */}
          {transfer.assigned_officer && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Görevli:</span>
              <span>{transfer.assigned_officer.username}</span>
            </div>
          )}
          
          {/* Airport */}
          {transfer.airport && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Havalimanı:</span>
              <span>{transfer.airport}</span>
            </div>
          )}
        </div>

        {/* Deadline Section */}
        <div className={`p-3 rounded-lg ${isOverdue ? 'bg-red-50' : isApproaching ? 'bg-orange-50' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${isOverdue ? 'text-red-600' : isApproaching ? 'text-orange-600' : 'text-gray-600'}`} />
              <span className={`font-medium ${isOverdue ? 'text-red-900' : isApproaching ? 'text-orange-900' : ''}`}>
                Deadline: {formatDateTime(transfer.deadline_datetime)}
              </span>
            </div>
            {canMarkAsReceived && (
              <CountdownTimer 
                deadline={transfer.deadline_datetime}
                showExpiredMessage={true}
                className={isOverdue ? 'text-red-600 font-bold' : ''}
              />
            )}
          </div>
        </div>

        {/* Notes */}
        {transfer.notes && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-medium">Not:</span> {transfer.notes}
            </p>
          </div>
        )}
        
        {/* Action Button */}
        {canMarkAsReceived && (
          <div className="pt-2">
            <Button 
              onClick={handlePatientReceived}
              disabled={isUpdating}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  İşleniyor...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Hasta Alındı
                </>
              )}
            </Button>
            
            {isOverdue && (
              <p className="text-xs text-red-600 text-center mt-2 font-medium">
                ⚠️ Deadline geçildi! Lütfen durumu güncelleyin.
              </p>
            )}
          </div>
        )}
        
        {/* Already Completed Message */}
        {transfer.status === 'patient_picked_up' && (
          <div className="flex items-center justify-center gap-2 text-green-600 py-2">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Hasta teslim alındı</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}