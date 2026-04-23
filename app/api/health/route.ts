import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const start = Date.now();

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('tenants').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'supabase unreachable', detail: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: 'unexpected error', detail: String(err) },
      { status: 503 }
    );
  }
}
