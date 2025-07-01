"use server";

import { z } from "zod";
import { createServerClient } from "@/lib/utils/supabase/server";
import { agencyActionClient, agencyEditorActionClient } from "@/lib/safe-action/agency-client";
import { authActionClient } from "@/lib/safe-action/auth-client";
import { revalidatePath } from "next/cache";
import { triggerStatusChangeNotification } from "./notification-actions";

// Schema for marking patient as received
const markPatientReceivedSchema = z.object({
  transferId: z.string().uuid("Geçersiz transfer ID"),
});

// Schema for bulk delete transfers
const bulkDeleteTransfersSchema = z.object({
  transferIds: z.array(z.string().uuid()).min(1, "En az bir transfer seçilmeli"),
});

// Schema for bulk update transfers
const bulkUpdateTransfersSchema = z.object({
  transferIds: z.array(z.string().uuid()).min(1),
  updates: z.object({
    status: z.enum(['pending', 'driver_assigned', 'patient_picked_up', 'completed', 'delayed', 'cancelled']).optional(),
    priority: z.number().int().min(0).max(10).optional(),
  }).refine(data => Object.keys(data).length > 0, {
    message: "En az bir güncelleme alanı seçilmeli"
  })
});

// Mark transfer as patient received (hasta alındı)
export const markPatientReceived = agencyActionClient
  .schema(markPatientReceivedSchema)
  .action(async ({ parsedInput: { transferId }, ctx: { user, agency } }) => {
    try {
      const supabase = await createServerClient();
      
      // First check if transfer belongs to agency
      const { data: transfer, error: fetchError } = await supabase
        .from('transfers')
        .select('id, status, assigned_agency_id, patient_name')
        .eq('id', transferId)
        .eq('assigned_agency_id', agency.id)
        .single();

      if (fetchError || !transfer) {
        return { 
          success: false, 
          error: "Transfer bulunamadı veya erişim yetkiniz yok" 
        };
      }

      // Check if already marked as received
      if (transfer.status === 'patient_picked_up' || transfer.status === 'completed') {
        return { 
          success: false, 
          error: "Transfer zaten hasta alındı olarak işaretlenmiş" 
        };
      }

      // Update transfer status
      const { data: updatedTransfer, error: updateError } = await supabase
        .from('transfers')
        .update({
          status: 'patient_picked_up',
          closed_at: new Date().toISOString(),
          closed_by_user_id: user.id,
          updated_at: new Date().toISOString(),
          updated_by_user_id: user.id,
          // Clear deadline notifications since patient is received
          agency_deadline_notified: true,
          deadline_confirmation_received: true,
          deadline_confirmation_datetime: new Date().toISOString()
        })
        .eq('id', transferId)
        .select()
        .single();

      if (updateError) {
        console.error('Transfer update error:', updateError);
        return { 
          success: false, 
          error: "Transfer güncellenirken hata oluştu" 
        };
      }

      // Trigger status change notification
      await triggerStatusChangeNotification({
        transferId,
        oldStatus: transfer.status,
        newStatus: 'patient_picked_up',
        updatedByUserId: user.id,
        agencyName: agency.name
      });

      // Revalidate relevant paths
      revalidatePath('/agency-dashboard');
      revalidatePath(`/transfers/${transferId}`);
      
      return { 
        success: true, 
        transfer: updatedTransfer,
        message: `${transfer.patient_name} için transfer "Hasta Alındı" olarak işaretlendi`
      };
      
    } catch (error) {
      console.error('Mark patient received error:', error);
      return { 
        success: false, 
        error: "Beklenmeyen bir hata oluştu" 
      };
    }
  });

// Bulk delete transfers (works for both agency users and super admins)
export const bulkDeleteTransfers = authActionClient
  .schema(bulkDeleteTransfersSchema)
  .action(async ({ parsedInput: { transferIds }, ctx: { user } }) => {
    try {
      console.log('🗑️ [BULK-DELETE-ACTION] Starting bulk delete...', {
        transferIds: transferIds.length,
        userRole: user.role,
        userId: user.id
      });
      
      const supabase = await createServerClient();
      
      // Different logic based on user role
      if (user.role === 'super_admin' || user.role === 'superuser' || user.role === 'admin') {
        console.log('👑 [BULK-DELETE-ACTION] Admin user - can delete any transfers');
        
        // Admin can delete any transfers - just verify they exist
        const { data: transfers, error: fetchError } = await supabase
          .from('transfers')
          .select('id, patient_name')
          .in('id', transferIds);

        if (fetchError) {
          console.error('💥 [BULK-DELETE-ACTION] Fetch error:', fetchError);
          return { 
            success: false, 
            error: "Transferler kontrol edilirken hata oluştu" 
          };
        }

        if (!transfers || transfers.length === 0) {
          console.log('⚠️ [BULK-DELETE-ACTION] No transfers found');
          return { 
            success: false, 
            error: "Silinecek transfer bulunamadı" 
          };
        }

        // Delete transfers
        const { error: deleteError } = await supabase
          .from('transfers')
          .delete()
          .in('id', transferIds);

        if (deleteError) {
          console.error('💥 [BULK-DELETE-ACTION] Delete error:', deleteError);
          return { 
            success: false, 
            error: "Transferler silinirken hata oluştu" 
          };
        }

        console.log('✅ [BULK-DELETE-ACTION] Admin delete successful:', transfers.length);
        
      } else if (user.agency_id) {
        console.log('🏢 [BULK-DELETE-ACTION] Agency user - checking agency permissions');
        
        // Agency user - verify transfers belong to their agency
        const { data: transfers, error: fetchError } = await supabase
          .from('transfers')
          .select('id, patient_name')
          .in('id', transferIds)
          .eq('assigned_agency_id', user.agency_id);

        if (fetchError || !transfers || transfers.length !== transferIds.length) {
          console.log('⚠️ [BULK-DELETE-ACTION] Agency permission check failed');
          return { 
            success: false, 
            error: "Bazı transferlere erişim yetkiniz yok" 
          };
        }

        // Delete transfers
        const { error: deleteError } = await supabase
          .from('transfers')
          .delete()
          .in('id', transferIds)
          .eq('assigned_agency_id', user.agency_id);

        if (deleteError) {
          console.error('💥 [BULK-DELETE-ACTION] Delete error:', deleteError);
          return { 
            success: false, 
            error: "Transferler silinirken hata oluştu" 
          };
        }

        console.log('✅ [BULK-DELETE-ACTION] Agency delete successful:', transfers.length);
        
      } else {
        console.log('🚫 [BULK-DELETE-ACTION] User has no permissions');
        return { 
          success: false, 
          error: "Bu işlem için yetkiniz yok" 
        };
      }

      // Revalidate paths
      revalidatePath('/agency-dashboard');
      revalidatePath('/transfers');
      
      return { 
        success: true, 
        deletedCount: transferIds.length,
        message: `${transferIds.length} transfer başarıyla silindi`
      };
      
    } catch (error) {
      console.error('💥 [BULK-DELETE-ACTION] Exception:', error);
      return { 
        success: false, 
        error: "Beklenmeyen bir hata oluştu" 
      };
    }
  });

// Bulk update transfers
export const bulkUpdateTransfers = agencyEditorActionClient
  .schema(bulkUpdateTransfersSchema)
  .action(async ({ parsedInput: { transferIds, updates }, ctx: { user, agency } }) => {
    try {
      const supabase = await createServerClient();
      
      // Verify all transfers belong to agency
      const { data: transfers, error: fetchError } = await supabase
        .from('transfers')
        .select('id, status')
        .in('id', transferIds)
        .eq('assigned_agency_id', agency.id);

      if (fetchError || !transfers || transfers.length !== transferIds.length) {
        return { 
          success: false, 
          error: "Bazı transferlere erişim yetkiniz yok" 
        };
      }

      // Prepare update data
      const updateData: any = {
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by_user_id: user.id
      };

      // If status is being updated to patient_picked_up or completed, set closed fields
      if (updates.status === 'patient_picked_up' || updates.status === 'completed') {
        updateData.closed_at = new Date().toISOString();
        updateData.closed_by_user_id = user.id;
        updateData.agency_deadline_notified = true;
        updateData.deadline_confirmation_received = true;
      }

      // Update transfers
      const { data: updatedTransfers, error: updateError } = await supabase
        .from('transfers')
        .update(updateData)
        .in('id', transferIds)
        .eq('assigned_agency_id', agency.id)
        .select();

      if (updateError) {
        console.error('Bulk update error:', updateError);
        return { 
          success: false, 
          error: "Transferler güncellenirken hata oluştu" 
        };
      }

      // If status was updated, trigger notifications for each transfer
      if (updates.status) {
        const notificationPromises = transfers.map(transfer => {
          if (transfer.status !== updates.status) {
            return triggerStatusChangeNotification({
              transferId: transfer.id,
              oldStatus: transfer.status,
              newStatus: updates.status!,
              updatedByUserId: user.id,
              agencyName: agency.name
            });
          }
          return Promise.resolve();
        });

        await Promise.allSettled(notificationPromises);
      }

      // Revalidate paths
      revalidatePath('/agency-dashboard');
      revalidatePath('/transfers');
      
      return { 
        success: true, 
        updatedCount: updatedTransfers.length,
        message: `${updatedTransfers.length} transfer başarıyla güncellendi`
      };
      
    } catch (error) {
      console.error('Bulk update error:', error);
      return { 
        success: false, 
        error: "Beklenmeyen bir hata oluştu" 
      };
    }
  });

// Get agency transfers with filters
export const getAgencyTransfers = agencyActionClient
  .schema(z.object({
    status: z.enum(['all', 'pending', 'driver_assigned', 'patient_picked_up', 'completed', 'delayed', 'cancelled']).optional(),
    search: z.string().optional(),
    limit: z.number().int().positive().default(50),
    offset: z.number().int().min(0).default(0)
  }))
  .action(async ({ parsedInput, ctx: { agency } }) => {
    try {
      const supabase = await createServerClient();
      
      let query = supabase
        .from('transfers')
        .select(`
          *,
          routes (id, name),
          location_from:locations!transfers_location_from_id_fkey (id, name),
          location_to:locations!transfers_location_to_id_fkey (id, name),
          agencies!transfers_assigned_agency_id_fkey (id, name),
          assigned_officer:user_profiles!transfers_assigned_officer_id_fkey (id, username)
        `, { count: 'exact' })
        .eq('assigned_agency_id', agency.id)
        .order('created_at', { ascending: false });

      // Apply filters
      if (parsedInput.status && parsedInput.status !== 'all') {
        query = query.eq('status', parsedInput.status);
      }

      if (parsedInput.search) {
        query = query.or(`patient_name.ilike.%${parsedInput.search}%,title.ilike.%${parsedInput.search}%`);
      }

      // Apply pagination
      query = query.range(parsedInput.offset, parsedInput.offset + parsedInput.limit - 1);

      const { data: transfers, error, count } = await query;

      if (error) {
        console.error('Get agency transfers error:', error);
        return { 
          success: false, 
          error: "Transferler yüklenirken hata oluştu" 
        };
      }

      return { 
        success: true, 
        transfers: transfers || [],
        totalCount: count || 0,
        hasMore: (count || 0) > parsedInput.offset + parsedInput.limit
      };
      
    } catch (error) {
      console.error('Get agency transfers error:', error);
      return { 
        success: false, 
        error: "Beklenmeyen bir hata oluştu" 
      };
    }
  });