// Task 2.11: GET/PUT /api/metrics/pricing — manage model pricing
import { NextRequest, NextResponse } from 'next/server';
import { getAllModelPricing, updateModelPricing } from '@/lib/metrics/cost-calculator';

export async function GET() {
  try {
    const pricing = getAllModelPricing();
    return NextResponse.json(pricing);
  } catch (error) {
    console.error('Failed to fetch pricing:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { model_name, input_price_per_1k, output_price_per_1k, provider } = body;

    if (!model_name || input_price_per_1k == null || output_price_per_1k == null) {
      return NextResponse.json(
        { error: 'model_name, input_price_per_1k, and output_price_per_1k are required' },
        { status: 400 }
      );
    }

    updateModelPricing(model_name, input_price_per_1k, output_price_per_1k, provider || 'anthropic');

    return NextResponse.json({ success: true, model_name });
  } catch (error) {
    console.error('Failed to update pricing:', error);
    return NextResponse.json({ error: 'Failed to update pricing' }, { status: 500 });
  }
}
