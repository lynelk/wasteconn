import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Service role for ML processing
    const sdk = base44.asServiceRole;

    // Fetch 2 years of historical pickup data
    const allPickups = await sdk.entities.PickupRequest.list('-created_date', 5000);
    
    if (allPickups.length < 100) {
      return Response.json({
        forecast: [],
        insights: ['Insufficient historical data for accurate forecasting. Need at least 100 records.'],
        trend: 'unknown'
      });
    }

    // Prepare historical data for ML analysis
    const historicalData = allPickups.map(p => ({
      date: p.scheduled_date || p.created_date,
      status: p.status,
      customer_type: p.customer_type,
      zone_id: p.zone_id
    }));

    // Use LLM for demand forecasting
    const forecastResult = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a waste management demand forecasting expert. Analyze this historical pickup data and provide a 3-month demand forecast.

Historical data (last 2 years):
${JSON.stringify(historicalData, null, 2)}

Tasks:
1. Identify seasonal patterns and trends
2. Predict monthly pickup demand for the next 3 months
3. Provide 3-5 key insights about demand patterns
4. Determine overall trend (increasing/decreasing/stable)

Return JSON in this exact format:
{
  "forecast": [
    {"month": "2026-07", "predicted_pickups": 450},
    {"month": "2026-08", "predicted_pickups": 470},
    {"month": "2026-09", "predicted_pickups": 490}
  ],
  "insights": [
    "Demand increases by 15% during rainy season",
    "Commercial pickups peak on Mondays",
    "Zone KLA-N-01 has highest growth rate"
  ],
  "trend": "increasing"
}

Be realistic and data-driven in your predictions.`,
      response_json_schema: {
        type: 'object',
        properties: {
          forecast: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                month: { type: 'string' },
                predicted_pickups: { type: 'number' }
              },
              required: ['month', 'predicted_pickups']
            }
          },
          insights: {
            type: 'array',
            items: { type: 'string' }
          },
          trend: { type: 'string', enum: ['increasing', 'decreasing', 'stable'] }
        },
        required: ['forecast', 'insights', 'trend']
      },
      model: 'gemini_3_1_pro'
    });

    return Response.json(forecastResult);
  } catch (error) {
    return Response.json({ 
      error: error.message,
      forecast: [],
      insights: ['Forecast unavailable due to processing error'],
      trend: 'unknown'
    }, { status: 500 });
  }
});