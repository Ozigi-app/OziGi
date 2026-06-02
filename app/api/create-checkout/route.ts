import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { phCapture } from '@/lib/posthog';

type Plan = 'starter' | 'growth' | 'pro';
type Interval = 'monthly' | 'yearly';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan, interval = 'monthly', successUrl, cancelUrl } = await req.json();
    if (!plan || !['starter', 'growth', 'pro'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const productIds: Record<Plan, Record<Interval, string>> = {
      starter: {
        monthly: 'pdt_0Ng3KxpDctsmZzkvR9RmM',
        yearly:  'pdt_0Ng3KxsMWqBgU9U9etp27',
      },
      growth: {
        monthly: 'pdt_0Ng3KxvdmDWWdclDsMBm8',
        yearly:  'pdt_0Ng3KxzWmRd0k0mq5tlJa',
      },
      pro: {
        monthly: 'pdt_0Ng3Ky3xlkd5RlLJV9jI9',
        yearly:  'pdt_0Ng3Ky77RmHesXIqWB800',
      },
    };

    const productId = productIds[plan as Plan][interval as Interval];
    if (!productId) {
      console.error('Product ID not configured for', plan, interval);
      return NextResponse.json({ error: 'Product not configured' }, { status: 500 });
    }

    const customerName =
      user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer';

    const response = await fetch('https://live.dodopayments.com/checkouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DODO_API_KEY}`,
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: user.email, name: customerName },
        return_url:
          successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
        cancel_url:
          cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=cancel`,
        metadata: { user_id: user.id, plan, interval },
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error('Dodo API error:', response.status, responseText);
      return NextResponse.json(
        { error: `Payment service error: ${response.status}` },
        { status: 500 }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid response from payment provider' },
        { status: 500 }
      );
    }

    if (!data.checkout_url) {
      return NextResponse.json({ error: 'No checkout URL returned' }, { status: 500 });
    }

    phCapture(user.id, 'checkout_started', {
      email: user.email,
      plan,
      interval,
      productId,
    }).catch(() => {})

    return NextResponse.json({ checkoutUrl: data.checkout_url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
