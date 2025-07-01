"use server";

import { createServerClient } from "@/lib/utils/supabase/server";
import { authActionClient } from "@/lib/safe-action/auth-client";
import { z } from "zod";

export interface TransferWithRelations {
  id: string;
  created_at: string;
  title: string;
  patient_name: string | null;
  airport: string | null;
  deadline_datetime: string;
  status: string | null;
  assigned_agency_id: string | null;
  agencies: { 
    name: string; 
    contact_information: { 
      name?: string; 
      phones?: string[] 
    } | null 
  } | null;
  routes: { 
    name: string; 
    requires_airport: boolean; 
  } | null;
  location_from: { 
    name: string; 
  } | null;
  location_to: { 
    name: string; 
  } | null;
}

// Get all transfers (accessible to all authenticated users)
export const getAllTransfers = authActionClient
  .schema(z.object({
    limit: z.number().optional().default(50),
    offset: z.number().optional().default(0),
    status: z.string().optional(),
    search: z.string().optional()
  }))
  .action(async ({ parsedInput: { limit, offset, status, search }, ctx: { supabase, user } }) => {
    console.log('📊 [GET-ALL-TRANSFERS] Starting transfer query...', {
      limit,
      offset,
      status,
      search,
      hasSupabase: !!supabase,
      hasUser: !!user,
      userRole: user?.role,
      userId: user?.id
    });
    
    try {
      console.log('🔍 [GET-ALL-TRANSFERS] Building query...');
      let query = supabase
        .from("transfers")
        .select(`
          id, 
          created_at, 
          title, 
          patient_name,
          airport,
          deadline_datetime, 
          status,
          assigned_agency_id,
          agencies!assigned_agency_id ( 
            name, 
            contact_information 
          ), 
          routes!related_route_id ( 
            name, 
            requires_airport 
          ),
          location_from:locations!location_from_id ( 
            name 
          ),
          location_to:locations!location_to_id ( 
            name 
          )
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply role-based filtering
      if (user?.role === 'user') {
        // User can only see transfers assigned to them
        console.log('🔍 [GET-ALL-TRANSFERS] Applying user filter:', user.id);
        query = query.eq('assigned_officer_id', user.id);
      }
      // Admin and Superuser can see all transfers

      // Apply filters
      if (status) {
        console.log('🔍 [GET-ALL-TRANSFERS] Applying status filter:', status);
        query = query.eq('status', status);
      }

      if (search) {
        console.log('🔍 [GET-ALL-TRANSFERS] Applying search filter:', search);
        query = query.or(`title.ilike.%${search}%,patient_name.ilike.%${search}%`);
      }

      console.log('📡 [GET-ALL-TRANSFERS] Executing query...');
      const { data, error } = await query;

      console.log('📊 [GET-ALL-TRANSFERS] Query result:', {
        hasData: !!data,
        dataCount: data?.length || 0,
        hasError: !!error,
        error: error?.message
      });

      if (error) {
        console.error('💥 [GET-ALL-TRANSFERS] Query error:', error);
        throw new Error(error.message);
      }

      console.log('✅ [GET-ALL-TRANSFERS] Query successful, returning data');
      return {
        success: true,
        data: data as TransferWithRelations[]
      };

    } catch (error) {
      console.error('💥 [GET-ALL-TRANSFERS] Unexpected error:', error);
      console.error('💥 [GET-ALL-TRANSFERS] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

// Create new transfer (only admin and superuser)
export const createTransfer = authActionClient
  .schema(z.object({
    title: z.string().min(1, "Başlık gerekli"),
    patient_name: z.string().min(1, "Hasta adı gerekli"),
    route_id: z.string().uuid("Geçersiz güzergah ID"),
    deadline_datetime: z.string().optional(),
    assigned_agency_id: z.string().uuid("Geçersiz ajans ID").optional(),
    assigned_officer_id: z.string().uuid("Geçersiz kullanıcı ID").optional(),
    notes: z.string().optional(),
    airport: z.string().optional(),
    clinic: z.string().optional(),
    notification_numbers: z.array(z.string()).optional(),
    notification_emails: z.array(z.string().email()).optional()
  }))
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    try {
      // Only admin and superuser can create transfers
      if (!user?.role || !['admin', 'superuser'].includes(user.role)) {
        return {
          success: false,
          error: "Bu işlem için yetkiniz yok"
        };
      }

      const { data, error } = await supabase
        .from("transfers")
        .insert({
          ...parsedInput,
          created_by_user_id: user.id,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Transfer creation error:', error);
        return {
          success: false,
          error: "Transfer oluşturulamadı"
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Create transfer error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer oluşturma hatası'
      };
    }
  });

export const getTransfersForOfficer = authActionClient
  .schema(z.object({}))
  .action(async () => {
    // Placeholder implementation
    return {
      success: false,
      error: 'getTransfersForOfficer not implemented yet'
    };
  });

export const updateTransfer = authActionClient
  .schema(z.object({
    id: z.string().uuid("Geçersiz transfer ID"),
    patient_name: z.string().min(1, "Hasta adı gerekli").optional(),
    title: z.string().optional(),
    airport: z.string().optional(),
    clinic: z.string().optional(),
    transfer_datetime: z.date("Geçersiz transfer tarihi").optional(),
    deadline_datetime: z.date("Geçersiz deadline tarihi").optional(),
    status: z.enum(['pending', 'driver_assigned', 'patient_picked_up', 'completed', 'delayed', 'cancelled']).optional(),
    assigned_agency_id: z.string().uuid("Geçersiz ajans ID").nullable().optional(),
    related_route_id: z.string().uuid("Geçersiz güzergah ID").nullable().optional(),
    location_from_id: z.string().uuid("Geçersiz konum ID").nullable().optional(),
    notification_numbers: z.array(z.string()).optional(),
  }))
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    try {
      console.log('🔄 [UPDATE-TRANSFER] Starting transfer update...', {
        transferId: parsedInput.id,
        userId: user?.id,
        userRole: user?.role
      });

      // Only admin, superuser, and assigned users can update transfers
      if (!user?.role || !['admin', 'superuser', 'agency', 'user'].includes(user.role)) {
        return {
          success: false,
          error: "Bu işlem için yetkiniz yok"
        };
      }

      // First check if transfer exists and user has permission
      const { data: existingTransfer, error: fetchError } = await supabase
        .from("transfers")
        .select("id, assigned_officer_id, assigned_agency_id, created_by_user_id")
        .eq("id", parsedInput.id)
        .single();

      if (fetchError || !existingTransfer) {
        console.error('💥 [UPDATE-TRANSFER] Transfer not found:', fetchError);
        return {
          success: false,
          error: "Transfer bulunamadı"
        };
      }

      // Check permissions based on role
      const canUpdate = 
        user.role === 'admin' || user.role === 'superuser' ||
        existingTransfer.assigned_officer_id === user.id ||
        existingTransfer.created_by_user_id === user.id;

      if (!canUpdate) {
        return {
          success: false,
          error: "Bu transfer'ı güncellemek için yetkiniz yok"
        };
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
        updated_by_user_id: user.id
      };

      // Add fields that are being updated
      if (parsedInput.patient_name !== undefined) {
        updateData.patient_name = parsedInput.patient_name;
      }
      if (parsedInput.title !== undefined) {
        updateData.title = parsedInput.title;
      }
      if (parsedInput.airport !== undefined) {
        updateData.airport = parsedInput.airport;
      }
      if (parsedInput.clinic !== undefined) {
        updateData.clinic = parsedInput.clinic;
      }
      if (parsedInput.transfer_datetime !== undefined) {
        updateData.transfer_datetime = parsedInput.transfer_datetime.toISOString();
      }
      if (parsedInput.deadline_datetime !== undefined) {
        updateData.deadline_datetime = parsedInput.deadline_datetime.toISOString();
      }
      if (parsedInput.status !== undefined) {
        updateData.status = parsedInput.status;
        
        // If marking as completed or patient_picked_up, set closed fields
        if (parsedInput.status === 'completed' || parsedInput.status === 'patient_picked_up') {
          updateData.closed_at = new Date().toISOString();
          updateData.closed_by_user_id = user.id;
        }
      }
      if (parsedInput.assigned_agency_id !== undefined) {
        updateData.assigned_agency_id = parsedInput.assigned_agency_id;
      }
      if (parsedInput.related_route_id !== undefined) {
        updateData.related_route_id = parsedInput.related_route_id;
      }
      if (parsedInput.location_from_id !== undefined) {
        updateData.location_from_id = parsedInput.location_from_id;
      }
      if (parsedInput.notification_numbers !== undefined) {
        updateData.notification_numbers = parsedInput.notification_numbers;
      }

      console.log('🔄 [UPDATE-TRANSFER] Update data prepared:', updateData);

      // Update the transfer
      const { data: updatedTransfer, error: updateError } = await supabase
        .from("transfers")
        .update(updateData)
        .eq("id", parsedInput.id)
        .select()
        .single();

      if (updateError) {
        console.error('💥 [UPDATE-TRANSFER] Update error:', updateError);
        return {
          success: false,
          error: "Transfer güncellenirken hata oluştu"
        };
      }

      console.log('✅ [UPDATE-TRANSFER] Transfer updated successfully');
      
      return {
        success: true,
        data: updatedTransfer,
        message: "Transfer başarıyla güncellendi"
      };

    } catch (error) {
      console.error('💥 [UPDATE-TRANSFER] Unexpected error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer güncelleme hatası'
      };
    }
  });