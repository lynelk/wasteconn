import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { entityName, ids, action } = payload;

    if (!entityName || !ids || !Array.isArray(ids) || !action) {
      return Response.json({ error: 'Invalid payload. Required: entityName, ids[], action' }, { status: 400 });
    }

    let result = { success: true, processed: 0, errors: [] };

    switch (action) {
      case 'delete': {
        for (const id of ids) {
          try {
            await base44.asServiceRole.entities[entityName].delete(id);
            result.processed++;
          } catch (err) {
            result.errors.push({ id, error: err.message });
          }
        }
        break;
      }

      case 'export': {
        // Export to CSV format
        const records = [];
        for (const id of ids) {
          try {
            const record = await base44.asServiceRole.entities[entityName].get(id);
            records.push(record);
          } catch (err) {
            result.errors.push({ id, error: err.message });
          }
        }
        
        // Create CSV
        if (records.length > 0) {
          const headers = Object.keys(records[0]).join(',');
          const rows = records.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
          const csv = `${headers}\n${rows}`;
          
          return new Response(csv, {
            status: 200,
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${entityName}_export_${new Date().toISOString().split('T')[0]}.csv"`
            }
          });
        }
        break;
      }

      case 'update': {
        // For update, we expect additional data in payload
        const updateData = payload.data || {};
        for (const id of ids) {
          try {
            await base44.asServiceRole.entities[entityName].update(id, updateData);
            result.processed++;
          } catch (err) {
            result.errors.push({ id, error: err.message });
          }
        }
        break;
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});