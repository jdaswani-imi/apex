import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, title, message_count, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { conversationId, messages } = await request.json() as {
    conversationId: string | null
    messages: { role: string; content: string; toolCalls?: unknown[]; actions?: unknown[] }[]
  }

  const contentMessages = messages.filter(m => m.content.trim())
  if (contentMessages.length === 0) return Response.json({ error: 'No messages' }, { status: 400 })

  const firstUserMsg = contentMessages.find(m => m.role === 'user')
  const title = firstUserMsg
    ? firstUserMsg.content.slice(0, 70) + (firstUserMsg.content.length > 70 ? '…' : '')
    : 'Conversation'

  let convId = conversationId

  if (!convId) {
    const { data: conv, error } = await supabase
      .from('chat_conversations')
      .insert({ user_id: user.id, title, message_count: contentMessages.length })
      .select('id')
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    convId = conv.id
  } else {
    // Verify ownership before touching any messages
    const { data: owned } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', convId)
      .eq('user_id', user.id)
      .single()

    if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

    await supabase
      .from('chat_conversations')
      .update({ title, message_count: contentMessages.length, updated_at: new Date().toISOString() })
      .eq('id', convId)
      .eq('user_id', user.id)
  }

  // Replace all messages for this conversation
  await supabase.from('chat_messages').delete().eq('conversation_id', convId)
  await supabase.from('chat_messages').insert(
    contentMessages.map(m => ({
      conversation_id: convId,
      user_id: user.id,
      role: m.role,
      content: m.content,
      tool_calls: m.toolCalls ?? null,
      actions: m.actions ?? null,
    })),
  )

  return Response.json({ conversationId: convId })
}
