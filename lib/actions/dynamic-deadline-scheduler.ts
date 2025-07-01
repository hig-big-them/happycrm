"use server";

import { createServiceClient } from "@/lib/utils/supabase/service";

export interface NextDeadlineInfo {
  nextDeadline: string | null;
  minutesUntil: number | null;
  transferCount: number;
  urgentCount: number; // deadline < 5 minutes
  recommendedCheckInterval: number; // minutes
}

// Get next deadline and recommend check interval
export const getNextDeadlineInfo = async (): Promise<NextDeadlineInfo> => {
  try {
    const supabase = createServiceClient();
    const now = new Date();
    
    // Get active transfers with upcoming deadlines
    const { data: transfers, error } = await supabase
      .from('transfers')
      .select('id, deadline_datetime, status, agency_deadline_notified')
      .not('status', 'in', '("patient_picked_up","completed","cancelled")')
      .eq('agency_deadline_notified', false)
      .gt('deadline_datetime', now.toISOString())
      .order('deadline_datetime', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Error fetching deadlines:', error);
      return {
        nextDeadline: null,
        minutesUntil: null,
        transferCount: 0,
        urgentCount: 0,
        recommendedCheckInterval: 15 // fallback
      };
    }

    if (!transfers || transfers.length === 0) {
      return {
        nextDeadline: null,
        minutesUntil: null,
        transferCount: 0,
        urgentCount: 0,
        recommendedCheckInterval: 15 // no active transfers
      };
    }

    // Find next deadline
    const nextDeadline = transfers[0].deadline_datetime;
    const nextDeadlineTime = new Date(nextDeadline);
    const minutesUntil = Math.floor((nextDeadlineTime.getTime() - now.getTime()) / (1000 * 60));

    // Count urgent transfers (deadline < 5 minutes)
    const urgentCount = transfers.filter(t => {
      const deadline = new Date(t.deadline_datetime);
      const minutesToDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60));
      return minutesToDeadline <= 5;
    }).length;

    // Calculate recommended check interval
    let recommendedInterval: number;
    
    if (urgentCount > 0) {
      recommendedInterval = 1; // Check every minute if urgent
    } else if (minutesUntil <= 5) {
      recommendedInterval = 1; // Check every minute for very close deadlines
    } else if (minutesUntil <= 15) {
      recommendedInterval = 2; // Check every 2 minutes for close deadlines
    } else if (minutesUntil <= 60) {
      recommendedInterval = 5; // Check every 5 minutes for medium deadlines
    } else if (minutesUntil <= 240) { // 4 hours
      recommendedInterval = 15; // Check every 15 minutes
    } else {
      recommendedInterval = 30; // Check every 30 minutes for distant deadlines
    }

    return {
      nextDeadline,
      minutesUntil,
      transferCount: transfers.length,
      urgentCount,
      recommendedCheckInterval: recommendedInterval
    };

  } catch (error) {
    console.error('Error in getNextDeadlineInfo:', error);
    return {
      nextDeadline: null,
      minutesUntil: null,
      transferCount: 0,
      urgentCount: 0,
      recommendedCheckInterval: 15
    };
  }
};

// Schedule next check based on deadline info
export const scheduleNextDeadlineCheck = async () => {
  const info = await getNextDeadlineInfo();
  
  console.log('📊 Deadline Info:', {
    nextDeadline: info.nextDeadline,
    minutesUntil: info.minutesUntil,
    transferCount: info.transferCount,
    urgentCount: info.urgentCount,
    recommendedInterval: info.recommendedCheckInterval
  });

  return info;
};