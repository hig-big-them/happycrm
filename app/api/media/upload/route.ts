import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/utils/supabase/server';
import { randomUUID } from 'crypto';

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
    const { fileName, fileType, leadId } = body;
    
    if (!fileName || !fileType || !leadId) {
      return NextResponse.json(
        { error: 'fileName, fileType, and leadId are required' },
        { status: 400 }
      );
    }
    
    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { error: 'File type not supported' },
        { status: 400 }
      );
    }
    
    // Check file size limit (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    
    // Generate unique file path
    const fileExt = fileName.split('.').pop();
    const uniqueFileName = `${randomUUID()}.${fileExt}`;
    const filePath = `messages/${leadId}/${uniqueFileName}`;
    
    try {
      // Create signed upload URL
      const { data, error } = await supabase.storage
        .from('media')
        .createSignedUploadUrl(filePath, {
          upsert: false
        });
      
      if (error) {
        console.error('Failed to create signed URL:', error);
        return NextResponse.json(
          { error: 'Failed to create upload URL' },
          { status: 500 }
        );
      }
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);
      
      return NextResponse.json({
        signedUrl: data.signedUrl,
        path: filePath,
        publicUrl: publicUrlData.publicUrl,
        maxSize: maxSize
      });
      
    } catch (error) {
      console.error('Storage error:', error);
      return NextResponse.json(
        { error: 'Storage service error' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Failed to create media upload URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check media status
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
    
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');
    
    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      );
    }
    
    try {
      // Check if file exists
      const { data, error } = await supabase.storage
        .from('media')
        .list(path.split('/').slice(0, -1).join('/'), {
          search: path.split('/').pop()
        });
      
      if (error) {
        return NextResponse.json(
          { exists: false, error: error.message },
          { status: 404 }
        );
      }
      
      const fileExists = data && data.length > 0;
      
      if (fileExists) {
        const { data: publicUrlData } = supabase.storage
          .from('media')
          .getPublicUrl(path);
        
        return NextResponse.json({
          exists: true,
          publicUrl: publicUrlData.publicUrl,
          file: data[0]
        });
      } else {
        return NextResponse.json({
          exists: false
        });
      }
      
    } catch (error) {
      console.error('Storage check error:', error);
      return NextResponse.json(
        { error: 'Storage service error' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Failed to check media status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}