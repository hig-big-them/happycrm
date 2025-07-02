import { NextRequest, NextResponse } from 'next/server';
import { getEventsSince, getEventCount } from '@/lib/services/message-events';
import { createClient } from '@/lib/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const since = searchParams.get('since');
    const leadId = searchParams.get('leadId');
    
    // Get events
    const events = getEventsSince(since, leadId || undefined);
    
    // Get the latest timestamp for next poll
    const latestTimestamp = events.length > 0 
      ? events[events.length - 1].timestamp 
      : new Date().toISOString();
    
    return NextResponse.json({
      events,
      latestTimestamp,
      eventCount: getEventCount()
    });
    
  } catch (error) {
    console.error('Failed to fetch message events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}