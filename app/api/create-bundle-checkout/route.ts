import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type BundleId = 'small' | 'medium' | 'large';

const BUNDLE_PRODUCT_IDS: Record<BundleId, string> = {
  small:  'pdt_0Ng3KyAEqRIz72yefBDim',  // 200 credits, $5
  medium: 'pdt_0Ng3KyDWoEN3GN1nCWUFV',  // 500 credits, $10
  large:  'pdt_0Ng3KyGkEPswQk0mFt6xc',  // 1,500 credits, $25
};

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

    const { bundle } = await req.json();
    if (!bundle || !['small', 'medium', 'large'].includes(bundle)) {
      return NextResponse.json({ error: 'Invalid bundle' }, { status: 400 });
    }

    const productId = BUNDLE_PRODUCT_IDS[bundle as BundleId];
    if (!productId) {
      console.error('Bundle product ID not configured for', bundle);
      return NextResponse.json({ error: 'Bundle not configured' }, { status: 500 });
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
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=credits`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=cancel`,
        metadata: { user_id: user.id, bundle, type: 'credit_bundle' },
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error('Dodo API error (bundle):', response.status, responseText);
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

    return NextResponse.json({ checkoutUrl: data.checkout_url });
  } catch (error: any) {
    console.error('Bundle checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
