import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { wodId, result, type } = await req.json()
    if (!wodId || !result || !type) throw new Error('Missing parameters')

    // 1. Check if already registered
    const { data: existing } = await supabaseClient
      .from('wod_results')
      .select('id')
      .eq('user_id', user.id)
      .eq('wod_id', wodId)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ success: false, alreadyRegistered: true, message: 'Resultado já registrado para este WOD' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 2. Insert WOD result
    const { error: insertError } = await supabaseClient
      .from('wod_results')
      .insert({
        user_id: user.id,
        wod_id: wodId,
        result: result,
        type: type
      })

    if (insertError) throw insertError

    // 3. Get economy settings
    const { data: economy } = await supabaseClient
      .from('avatar_economy_settings')
      .select('*')
      .eq('is_active', true)
      .single()

    const xpToAdd = economy?.xp_per_checkin || 30 // Fallback to 30 XP (similar to checkin but slightly higher as WOD is core)
    const coinsToAdd = economy?.coins_per_checkin || 10 // Fallback to 10 Coins

    // 4. Get current profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('xp, coins, level')
      .eq('id', user.id)
      .single()

    if (!profile) throw new Error('Profile not found')

    const newXp = (profile.xp || 0) + xpToAdd
    const newCoins = (profile.coins || 0) + coinsToAdd
    
    // Level up logic (100 XP per level as per rewards.ts)
    const xpToNextLevel = profile.level * 100
    let newLevel = profile.level
    let levelUp = false
    
    if (newXp >= xpToNextLevel) {
      newLevel += 1
      levelUp = true
    }

    // 5. Update profile
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ 
        xp: newXp, 
        coins: newCoins, 
        level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) throw updateError

    // 6. Insert reward history
    const { data: wod } = await supabaseClient
      .from('wods')
      .select('name')
      .eq('id', wodId)
      .single()

    const { error: historyError } = await supabaseClient
      .from('reward_history')
      .insert({
        user_id: user.id,
        type: 'wod',
        xp: xpToAdd,
        coins: coinsToAdd,
        description: `WOD: ${wod?.name || 'Diário'}`
      })

    if (historyError) console.error('Error inserting reward history:', historyError)

    return new Response(
      JSON.stringify({ 
        success: true, 
        xp: xpToAdd, 
        coins: coinsToAdd, 
        levelUp,
        newLevel
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
