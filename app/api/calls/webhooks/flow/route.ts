export const dynamic = "force-static"

import { NextRequest, NextResponse } from 'next/server';
import { addWebhookLog } from '../../../../../lib/services/webhook-logger';

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
    },
  });
}

// GET handler for testing
export async function GET() {
  return NextResponse.json({
    message: "Studio Flow Webhook endpoint is active",
    usage: "POST JSON data with flow events",
    expectedFields: [
      "flow_sid",
      "execution_sid",
      "event",
      "widget_name"
    ]
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== TWILIO STUDIO FLOW - FLOW WEBHOOK ===");
    
    // Parse body
    let body: any = {};
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      params.forEach((value, key) => {
        body[key] = value;
      });
    } else if (contentType?.includes('application/json')) {
      body = await request.json();
    } else {
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        const params = new URLSearchParams(text);
        params.forEach((value, key) => {
          body[key] = value;
        });
      }
    }
    
    console.log('Flow Webhook body:', body);
    
    // Log to webhook monitor
    addWebhookLog('FLOW_START', '/api/calls/webhooks/flow', body, {
      executionSid: body.execution_sid || body.ExecutionSid,
      phoneNumber: body.to || body.To,
    });
    
    // Return 200 OK immediately
    return new Response('OK', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
      }
    });
  } catch (error) {
    console.error('Flow webhook error:', error);
    // Even on error, return 200 to prevent retry storm
    return new Response('OK', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}