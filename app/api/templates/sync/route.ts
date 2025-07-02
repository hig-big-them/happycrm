import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/utils/supabase/server';
import twilio from 'twilio';

// Twilio istemcisini oluştur
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

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
    
    // Fetch Twilio content templates
    const contents = await twilioClient.content.v1.contents.list();
    
    const templates = contents.map(content => ({
      sid: content.sid,
      friendly_name: content.friendlyName,
      language: content.language,
      variables: content.variables ? Object.keys(content.variables) : [],
      types: content.types,
      status: content.approvalRequests ? 'approved' : 'pending'
    }));
    
    return NextResponse.json({
      templates,
      count: templates.length
    });
    
  } catch (error) {
    console.error('Failed to sync templates:', error);
    return NextResponse.json(
      { error: 'Failed to sync templates' },
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
    const { name, content, language = 'tr' } = body;
    
    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      );
    }
    
    // Create Twilio content template
    const twilioContent = await twilioClient.content.v1.contents.create({
      friendlyName: name,
      language: language,
      types: {
        'twilio/text': {
          body: content
        }
      }
    });
    
    // Save to database for local reference
    const { data: template, error } = await supabase
      .from('templates')
      .insert({
        name: name,
        content: content,
        content_sid: twilioContent.sid,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to save template locally:', error);
    }
    
    return NextResponse.json({
      success: true,
      template: {
        sid: twilioContent.sid,
        name: name,
        content: content,
        status: 'pending'
      }
    });
    
  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}