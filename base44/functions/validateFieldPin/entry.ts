import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Simple PIN validation using a hash stored on the user record.
// PIN is stored as SHA-256(user_id + ":" + pin) for security.

async function hashPin(userId, pin) {
  const data = new TextEncoder().encode(`${userId}:${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Allow unauthenticated access so inactive users can switch
    const { user_id, pin, action, new_pin } = await req.json();

    if (!user_id || !pin) {
      return Response.json({ error: 'user_id and pin required' }, { status: 400 });
    }

    // Fetch the user record (service role to read any user)
    const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
    const user = users?.[0];
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // If action is "set_pin", set a new PIN (requires the user to be authenticated)
    if (action === 'set_pin') {
      const me = await base44.auth.me();
      if (!me || me.id !== user_id) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const newHash = await hashPin(user_id, new_pin || pin);
      await base44.asServiceRole.entities.User.update(user_id, { pin_hash: newHash });
      return Response.json({ success: true });
    }

    // Validate PIN
    if (!user.pin_hash) {
      // No PIN set — first time, auto-approve and set the PIN
      const hash = await hashPin(user_id, pin);
      await base44.asServiceRole.entities.User.update(user_id, { pin_hash: hash });
      return Response.json({ valid: true, first_time: true });
    }

    const hash = await hashPin(user_id, pin);
    const valid = hash === user.pin_hash;
    return Response.json({ valid });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});