import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔍 DTMF Debugging Started...\n');
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    
    if (!accountSid || !authToken || !twilioPhoneNumber) {
      return NextResponse.json({
        error: 'Twilio credentials missing',
        available: {
          accountSid: !!accountSid,
          authToken: !!authToken, 
          twilioPhoneNumber: !!twilioPhoneNumber
        }
      }, { status: 500 });
    }
    
    const twilio = await import('twilio');
    const client = new twilio.default(accountSid, authToken);
    
    // 1. Son çağrıları listele
    const calls = await client.calls.list({ limit: 5 });
    
    const callsInfo = calls.map(call => ({
      sid: call.sid,
      to: call.to,
      from: call.from,
      status: call.status,
      startTime: call.startTime,
      endTime: call.endTime,
      duration: call.duration,
      direction: call.direction
    }));
    
    // 2. Studio Flow Executions kontrol et
    const flows = await client.studio.v2.flows.list({ limit: 3 });
    
    const flowsInfo = [];
    for (const flow of flows) {
      try {
        const executions = await client.studio.v2
          .flows(flow.sid)
          .executions
          .list({ limit: 5 });
          
        const executionsInfo = executions.map(exec => ({
          sid: exec.sid,
          status: exec.status,
          contactChannelAddress: exec.contactChannelAddress,
          dateCreated: exec.dateCreated,
          dateUpdated: exec.dateUpdated
        }));
        
        flowsInfo.push({
          flowSid: flow.sid,
          friendlyName: flow.friendlyName,
          status: flow.status,
          executions: executionsInfo
        });
      } catch (err) {
        flowsInfo.push({
          flowSid: flow.sid,
          friendlyName: flow.friendlyName,
          error: (err as Error).message
        });
      }
    }
    
    // 3. Account bilgileri
    const account = await client.api.v2010.accounts(accountSid).fetch();
    
    return NextResponse.json({
      success: true,
      data: {
        account: {
          sid: account.sid,
          status: account.status,
          type: account.type
        },
        recentCalls: callsInfo,
        studioFlows: flowsInfo,
        twilioConfig: {
          accountSid: accountSid,
          phoneNumber: twilioPhoneNumber
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Debug Error:', error);
    return NextResponse.json({
      error: (error as Error).message,
      code: (error as any).code
    }, { status: 500 });
  }
}