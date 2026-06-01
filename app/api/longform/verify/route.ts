/**
 * POST /api/longform/verify
 * Stage 2: VERIFY — resolves every URL in a plan's source budget.
 * Hard gate: if >20% are dead/NO, returns gate_triggered=true.
 * Updates the plan's source_budget in DB with annotated results.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getPlanStatus } from '@/lib/plan';
import { verifySources } from '@/lib/longform/verify-sources';
import type { SourceBudgetEntry } from '@/lib/types/longform';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const planStatus = await getPlanStatus(user.id);
    if (!planStatus.hasLongForm) {
      return NextResponse.json(
        { error: 'You have used your long-form article for this month. Upgrade to Pro for unlimited.' },
        { status: 403 }
      );
    }

    const { plan_id, source_budget } = await req.json();

    let budget: SourceBudgetEntry[] = [];

    if (plan_id) {
      // Load from DB
      const { data: plan, error: planError } = await supabaseAdmin
        .from('longform_plans')
        .select('source_budget')
        .eq('id', plan_id)
        .eq('user_id', user.id)
        .single();

      if (planError || !plan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      budget = Array.isArray(plan.source_budget) ? plan.source_budget : [];
    } else if (Array.isArray(source_budget)) {
      budget = source_budget;
    } else {
      return NextResponse.json({ error: 'Provide plan_id or source_budget' }, { status: 400 });
    }

    if (budget.length === 0) {
      return NextResponse.json({
        annotated_budget: [],
        dead_count: 0,
        total_count: 0,
        dead_rate: 0,
        gate_triggered: false,
      });
    }

    const result = await verifySources(budget);

    // Persist annotated budget back to the plan
    if (plan_id) {
      await supabaseAdmin
        .from('longform_plans')
        .update({ source_budget: result.annotated_budget })
        .eq('id', plan_id)
        .eq('user_id', user.id);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Verify] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
