import { NextRequest, NextResponse } from 'next/server';
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
    const leadId = searchParams.get('leadId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const channel = searchParams.get('channel'); // filter by channel
    
    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }
    
    // Build query
    let query = supabase
      .from('messages')
      .select(`
        id,
        lead_id,
        body,
        media_url,
        twilio_message_sid,
        is_from_lead,
        is_read,
        is_starred,
        status,
        channel,
        template_id,
        template_name,
        created_at,
        updated_at,
        read_at,
        starred_at
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Apply channel filter if specified
    if (channel) {
      query = query.eq('channel', channel);
    }
    
    const { data: messages, error } = await query;
    
    if (error) {
      console.error('Failed to fetch messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }
    
    // Get unread count for this lead
    const { count: unreadCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .eq('is_from_lead', true)
      .eq('is_read', false);
    
    return NextResponse.json({
      messages,
      unreadCount: unreadCount || 0,
      pagination: {
        offset,
        limit,
        hasMore: messages.length === limit
      }
    });
    
  } catch (error) {
    console.error('Failed to fetch message history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    
    const body = await request.json();
    const { leadId, messageIds, action } = body;
    
    if (!leadId || !messageIds || !Array.isArray(messageIds)) {
      return NextResponse.json(
        { error: 'Lead ID and message IDs are required' },
        { status: 400 }
      );
    }
    
    let updateData: any = {};
    
    switch (action) {
      case 'mark_read':
        updateData = {
          is_read: true,
          read_at: new Date().toISOString()
        };
        break;
      
      case 'mark_unread':
        updateData = {
          is_read: false,
          read_at: null
        };
        break;
      
      case 'star':
        updateData = {
          is_starred: true,
          starred_at: new Date().toISOString()
        };
        break;
      
      case 'unstar':
        updateData = {
          is_starred: false,
          starred_at: null
        };
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
    // Update messages
    const { error } = await supabase
      .from('messages')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('lead_id', leadId)
      .in('id', messageIds);
    
    if (error) {
      console.error('Failed to update messages:', error);
      return NextResponse.json(
        { error: 'Failed to update messages' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      updatedCount: messageIds.length
    });
    
  } catch (error) {
    console.error('Failed to update message history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}