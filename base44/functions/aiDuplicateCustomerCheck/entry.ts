import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// AI Duplicate Customer Detection
// Uses fuzzy name matching + GPS proximity scoring to detect potential ghost accounts.
// Called during onboarding to check if a new customer might already exist.

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 1 : 1 - levenshtein(na, nb) / maxLen;
}

function gpsDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { full_name, phone, email, latitude, longitude } = body;

    if (!full_name) return Response.json({ error: 'full_name is required' }, { status: 400 });

    const allCustomers = await base44.asServiceRole.entities.Customer.list();

    const candidates = [];

    for (const existing of allCustomers) {
      let score = 0;
      const reasons = [];

      // Exact phone match
      if (phone && existing.phone && phone === existing.phone) {
        score += 60;
        reasons.push('Same phone number');
      }

      // Exact email match
      if (email && existing.email && email.toLowerCase() === existing.email.toLowerCase()) {
        score += 50;
        reasons.push('Same email address');
      }

      // Fuzzy name similarity
      const nameSim = nameSimilarity(full_name, existing.full_name);
      if (nameSim >= 0.85) {
        score += Math.round(nameSim * 40);
        reasons.push(`Name similarity: ${Math.round(nameSim * 100)}%`);
      }

      // GPS proximity (< 50m = same address)
      if (latitude && longitude && existing.latitude && existing.longitude) {
        const dist = gpsDistance(latitude, longitude, existing.latitude, existing.longitude);
        if (dist < 50) {
          score += 30;
          reasons.push(`Same GPS location (${Math.round(dist)}m away)`);
        } else if (dist < 200) {
          score += 15;
          reasons.push(`Very close GPS location (${Math.round(dist)}m away)`);
        }
      }

      if (score >= 40) {
        candidates.push({
          customer_id: existing.id,
          customer_name: existing.full_name,
          phone: existing.phone,
          email: existing.email,
          customer_type: existing.customer_type,
          status: existing.status,
          match_score: Math.min(100, score),
          match_reasons: reasons,
          risk: score >= 70 ? 'high' : 'medium',
        });
      }
    }

    candidates.sort((a, b) => b.match_score - a.match_score);

    return Response.json({
      success: true,
      duplicates_found: candidates.length,
      candidates: candidates.slice(0, 5),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});