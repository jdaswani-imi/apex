import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSupabaseMock, makeUnauthSupabase, makeQueryBuilder } from '../mocks/supabase'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const mockCreateClient = vi.mocked(createClient)

function makePostRequest(body: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
}

// ---------------------------------------------------------------------------
// GET /api/chat/history
// ---------------------------------------------------------------------------
describe('GET /api/chat/history', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  async function importRoute() {
    return import('@/app/api/chat/history/route')
  }

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    const res = await GET()

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('returns empty array when no conversations exist', async () => {
    const { client, queryBuilder } = makeSupabaseMock({ queryResult: { data: null, error: null } })
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual([])
    expect(client.from).toHaveBeenCalledWith('chat_conversations')
  })

  it('returns conversation list on success', async () => {
    const conversations = [
      { id: 'conv-1', title: 'Hello', message_count: 3, created_at: '2024-01-01', updated_at: '2024-01-02' },
      { id: 'conv-2', title: 'World', message_count: 1, created_at: '2024-01-03', updated_at: '2024-01-04' },
    ]
    const { client } = makeSupabaseMock({ queryResult: { data: conversations, error: null } })
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(conversations)
  })

  it('returns 500 when supabase query errors', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: { message: 'DB exploded' } } })
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'DB exploded' })
  })

  it('applies eq(user_id), order, and limit on the query', async () => {
    const { client, queryBuilder } = makeSupabaseMock({ queryResult: { data: [], error: null } })
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    await GET()

    expect(queryBuilder.select).toHaveBeenCalledWith('id, title, message_count, created_at, updated_at')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(queryBuilder.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(queryBuilder.limit).toHaveBeenCalledWith(50)
  })
})

// ---------------------------------------------------------------------------
// POST /api/chat/history
// ---------------------------------------------------------------------------
describe('POST /api/chat/history', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  async function importRoute() {
    return import('@/app/api/chat/history/route')
  }

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({ conversationId: null, messages: [{ role: 'user', content: 'hi' }] })
    const res = await POST(req)

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('returns 400 when all messages have empty content', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({ conversationId: null, messages: [{ role: 'user', content: '   ' }] })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'No messages' })
  })

  it('returns 400 when messages array is empty', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({ conversationId: null, messages: [] })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'No messages' })
  })

  it('creates a new conversation when conversationId is null', async () => {
    // first from() call: insert conversation -> returns { id: 'new-conv' }
    // subsequent from() calls: delete + insert messages
    const insertBuilder = makeQueryBuilder({ data: { id: 'new-conv' }, error: null })
    const otherBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(insertBuilder)   // insert conversation
        .mockReturnValueOnce(otherBuilder)    // delete messages
        .mockReturnValueOnce(otherBuilder),   // insert messages
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: null,
      messages: [{ role: 'user', content: 'Hello world' }],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ conversationId: 'new-conv' })
    expect(client.from).toHaveBeenCalledWith('chat_conversations')
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', title: 'Hello world' }),
    )
  })

  it('truncates title at 70 chars and appends ellipsis', async () => {
    const longContent = 'A'.repeat(80)
    const insertBuilder = makeQueryBuilder({ data: { id: 'conv-trunc' }, error: null })
    const otherBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(otherBuilder)
        .mockReturnValueOnce(otherBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({ conversationId: null, messages: [{ role: 'user', content: longContent }] })
    await POST(req)

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'A'.repeat(70) + '…' }),
    )
  })

  it('uses "Conversation" as title when there are no user messages', async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: 'conv-notitle' }, error: null })
    const otherBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(otherBuilder)
        .mockReturnValueOnce(otherBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({ conversationId: null, messages: [{ role: 'assistant', content: 'Hi there' }] })
    await POST(req)

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Conversation' }),
    )
  })

  it('returns 500 when inserting new conversation fails', async () => {
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: 'insert failed' } })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn().mockReturnValue(insertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({ conversationId: null, messages: [{ role: 'user', content: 'hello' }] })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'insert failed' })
  })

  it('updates existing conversation when conversationId is provided and owned', async () => {
    // from calls order: ownership check, update conv, delete msgs, insert msgs
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'existing-conv' }, error: null })
    const otherBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)  // ownership check
        .mockReturnValueOnce(otherBuilder)       // update conversation
        .mockReturnValueOnce(otherBuilder)       // delete messages
        .mockReturnValueOnce(otherBuilder),      // insert messages
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: 'existing-conv',
      messages: [{ role: 'user', content: 'Updated message' }],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ conversationId: 'existing-conv' })
  })

  it('returns 404 when conversationId does not belong to user', async () => {
    // ownership check returns null (not owned)
    const ownershipBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn().mockReturnValue(ownershipBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: 'foreign-conv',
      messages: [{ role: 'user', content: 'Sneaky message' }],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'Not found' })
  })

  it('inserts messages with toolCalls and actions when provided', async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: 'conv-tools' }, error: null })
    const msgDeleteBuilder = makeQueryBuilder({ data: null, error: null })
    const msgInsertBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(msgDeleteBuilder)
        .mockReturnValueOnce(msgInsertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: null,
      messages: [
        { role: 'user', content: 'Run tool', toolCalls: [{ name: 'search' }], actions: [{ type: 'click' }] },
      ],
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(msgInsertBuilder.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          tool_calls: [{ name: 'search' }],
          actions: [{ type: 'click' }],
        }),
      ]),
    )
  })

  // -------------------------------------------------------------------------
  // Gap 1 & 2: tool_calls and actions default to null when absent
  // -------------------------------------------------------------------------
  it('sets tool_calls to null when toolCalls is absent', async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: 'conv-no-tools' }, error: null })
    const msgDeleteBuilder = makeQueryBuilder({ data: null, error: null })
    const msgInsertBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(msgDeleteBuilder)
        .mockReturnValueOnce(msgInsertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: null,
      messages: [{ role: 'user', content: 'No tool calls here' }],
    })
    await POST(req)

    expect(msgInsertBuilder.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ tool_calls: null }),
      ]),
    )
  })

  it('sets actions to null when actions is absent', async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: 'conv-no-actions' }, error: null })
    const msgDeleteBuilder = makeQueryBuilder({ data: null, error: null })
    const msgInsertBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(msgDeleteBuilder)
        .mockReturnValueOnce(msgInsertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: null,
      messages: [{ role: 'user', content: 'No actions here' }],
    })
    await POST(req)

    expect(msgInsertBuilder.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ actions: null }),
      ]),
    )
  })

  it('sets tool_calls to null when toolCalls is explicitly undefined', async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: 'conv-undef-tools' }, error: null })
    const msgDeleteBuilder = makeQueryBuilder({ data: null, error: null })
    const msgInsertBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(msgDeleteBuilder)
        .mockReturnValueOnce(msgInsertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: null,
      messages: [{ role: 'user', content: 'Undefined tools', toolCalls: undefined, actions: undefined }],
    })
    await POST(req)

    expect(msgInsertBuilder.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ tool_calls: null, actions: null }),
      ]),
    )
  })

  // -------------------------------------------------------------------------
  // Gap 3: multiple messages in payload - all messages mapped and inserted
  // -------------------------------------------------------------------------
  it('inserts all content messages in a multi-message payload', async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: 'conv-multi' }, error: null })
    const msgDeleteBuilder = makeQueryBuilder({ data: null, error: null })
    const msgInsertBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(msgDeleteBuilder)
        .mockReturnValueOnce(msgInsertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: null,
      messages: [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Second message' },
        { role: 'user', content: 'Third message' },
      ],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ conversationId: 'conv-multi' })

    const insertedMessages = msgInsertBuilder.insert.mock.calls[0][0] as unknown[]
    expect(insertedMessages).toHaveLength(3)
    expect(insertedMessages).toEqual([
      expect.objectContaining({ role: 'user', content: 'First message', conversation_id: 'conv-multi', user_id: 'user-123' }),
      expect.objectContaining({ role: 'assistant', content: 'Second message', conversation_id: 'conv-multi', user_id: 'user-123' }),
      expect.objectContaining({ role: 'user', content: 'Third message', conversation_id: 'conv-multi', user_id: 'user-123' }),
    ])
  })

  it('filters out empty-content messages from multi-message insert', async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: 'conv-filtered' }, error: null })
    const msgDeleteBuilder = makeQueryBuilder({ data: null, error: null })
    const msgInsertBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(msgDeleteBuilder)
        .mockReturnValueOnce(msgInsertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: null,
      messages: [
        { role: 'user', content: 'Real message' },
        { role: 'assistant', content: '   ' },
        { role: 'user', content: 'Another real message' },
      ],
    })
    await POST(req)

    const insertedMessages = msgInsertBuilder.insert.mock.calls[0][0] as unknown[]
    expect(insertedMessages).toHaveLength(2)
    expect(insertedMessages).toEqual([
      expect.objectContaining({ content: 'Real message' }),
      expect.objectContaining({ content: 'Another real message' }),
    ])
  })

  // -------------------------------------------------------------------------
  // Gap 4: message_count value correctness
  // -------------------------------------------------------------------------
  it('sets message_count to the number of content messages on new conversation insert', async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: 'conv-count' }, error: null })
    const otherBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(otherBuilder)
        .mockReturnValueOnce(otherBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: null,
      messages: [
        { role: 'user', content: 'Message one' },
        { role: 'assistant', content: 'Message two' },
        { role: 'user', content: '   ' },  // this should be excluded
      ],
    })
    await POST(req)

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ message_count: 2 }),
    )
  })

  it('sets message_count correctly on existing conversation update', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'existing-conv' }, error: null })
    const updateBuilder = makeQueryBuilder({ data: null, error: null })
    const otherBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)  // ownership check
        .mockReturnValueOnce(updateBuilder)      // update conversation
        .mockReturnValueOnce(otherBuilder)       // delete messages
        .mockReturnValueOnce(otherBuilder),      // insert messages
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: 'existing-conv',
      messages: [
        { role: 'user', content: 'Msg A' },
        { role: 'assistant', content: 'Msg B' },
        { role: 'user', content: 'Msg C' },
      ],
    })
    await POST(req)

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ message_count: 3 }),
    )
  })

  // -------------------------------------------------------------------------
  // Gap 5: existing conversation - delete and insert called with correct conversation_id
  // -------------------------------------------------------------------------
  it('deletes and re-inserts messages using the correct conversation_id for existing conversation', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'existing-conv' }, error: null })
    const updateBuilder = makeQueryBuilder({ data: null, error: null })
    const msgDeleteBuilder = makeQueryBuilder({ data: null, error: null })
    const msgInsertBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(updateBuilder)
        .mockReturnValueOnce(msgDeleteBuilder)
        .mockReturnValueOnce(msgInsertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: 'existing-conv',
      messages: [{ role: 'user', content: 'Updated content' }],
    })
    await POST(req)

    expect(msgDeleteBuilder.eq).toHaveBeenCalledWith('conversation_id', 'existing-conv')
    expect(msgInsertBuilder.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ conversation_id: 'existing-conv', user_id: 'user-123' }),
      ]),
    )
  })

  it('deletes old messages before inserting new ones for existing conversation', async () => {
    const callOrder: string[] = []

    const ownershipBuilder = makeQueryBuilder({ data: { id: 'existing-conv' }, error: null })
    const updateBuilder = makeQueryBuilder({ data: null, error: null })
    const msgDeleteBuilder = makeQueryBuilder({ data: null, error: null })
    const msgInsertBuilder = makeQueryBuilder({ data: null, error: null })

    // Track call order via side effects
    const originalDelete = msgDeleteBuilder.delete
    msgDeleteBuilder.delete = vi.fn(() => {
      callOrder.push('delete')
      return originalDelete()
    })
    const originalInsert = msgInsertBuilder.insert
    msgInsertBuilder.insert = vi.fn((args: unknown) => {
      callOrder.push('insert')
      return originalInsert(args)
    })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(updateBuilder)
        .mockReturnValueOnce(msgDeleteBuilder)
        .mockReturnValueOnce(msgInsertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: 'existing-conv',
      messages: [{ role: 'user', content: 'Updated content' }],
    })
    await POST(req)

    expect(callOrder.indexOf('delete')).toBeLessThan(callOrder.indexOf('insert'))
  })

  // -------------------------------------------------------------------------
  // Gap 6: conversationId is empty string - takes new-conversation path
  // -------------------------------------------------------------------------
  it('treats empty string conversationId as new conversation (falsy branch)', async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: 'conv-from-empty' }, error: null })
    const otherBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(otherBuilder)
        .mockReturnValueOnce(otherBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: '',
      messages: [{ role: 'user', content: 'Hello from empty id' }],
    })
    const res = await POST(req)
    const json = await res.json()

    // Empty string is falsy so the code creates a new conversation
    expect(res.status).toBe(200)
    expect(json).toEqual({ conversationId: 'conv-from-empty' })
    // insert (not ownership-check) should have been called on chat_conversations
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123' }),
    )
  })

  // -------------------------------------------------------------------------
  // Gap 7: updated_at is included in the update payload for existing conversations
  // -------------------------------------------------------------------------
  it('includes updated_at ISO string in update payload for existing conversation', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    vi.setSystemTime(now)

    const ownershipBuilder = makeQueryBuilder({ data: { id: 'existing-conv' }, error: null })
    const updateBuilder = makeQueryBuilder({ data: null, error: null })
    const otherBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(updateBuilder)
        .mockReturnValueOnce(otherBuilder)
        .mockReturnValueOnce(otherBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: 'existing-conv',
      messages: [{ role: 'user', content: 'Time-stamped update' }],
    })
    await POST(req)

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ updated_at: now.toISOString() }),
    )

    vi.useRealTimers()
  })

  it('updated_at in update payload is a valid ISO 8601 string', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'existing-conv' }, error: null })
    const updateBuilder = makeQueryBuilder({ data: null, error: null })
    const otherBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(updateBuilder)
        .mockReturnValueOnce(otherBuilder)
        .mockReturnValueOnce(otherBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makePostRequest({
      conversationId: 'existing-conv',
      messages: [{ role: 'user', content: 'Check timestamp format' }],
    })
    await POST(req)

    const updateArg = updateBuilder.update.mock.calls[0][0] as Record<string, unknown>
    expect(typeof updateArg.updated_at).toBe('string')
    expect(new Date(updateArg.updated_at as string).toISOString()).toBe(updateArg.updated_at)
  })
})

// ---------------------------------------------------------------------------
// GET /api/chat/history/[id]
// ---------------------------------------------------------------------------
describe('GET /api/chat/history/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  async function importRoute() {
    return import('@/app/api/chat/history/[id]/route')
  }

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) }
  }

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    const res = await GET({} as Request, makeParams('conv-1'))

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('returns 404 when conversation does not belong to user', async () => {
    // ownership check: data null means not owned
    const ownershipBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn().mockReturnValue(ownershipBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    const res = await GET({} as Request, makeParams('foreign-conv'))

    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not found')
  })

  it('returns messages when conversation is owned by user', async () => {
    const messages = [
      { role: 'user', content: 'Hello', tool_calls: null, actions: null, created_at: '2024-01-01' },
      { role: 'assistant', content: 'Hi!', tool_calls: null, actions: null, created_at: '2024-01-01' },
    ]

    const ownershipBuilder = makeQueryBuilder({ data: { id: 'conv-1' }, error: null })
    const messagesBuilder = makeQueryBuilder({ data: messages, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)  // ownership check
        .mockReturnValueOnce(messagesBuilder),   // fetch messages
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    const res = await GET({} as Request, makeParams('conv-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(messages)
  })

  it('returns empty array when conversation has no messages', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'conv-empty' }, error: null })
    const messagesBuilder = makeQueryBuilder({ data: null, error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(messagesBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    const res = await GET({} as Request, makeParams('conv-empty'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual([])
  })

  it('returns 500 when fetching messages errors', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'conv-1' }, error: null })
    const messagesBuilder = makeQueryBuilder({ data: null, error: { message: 'read error' } })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(messagesBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    const res = await GET({} as Request, makeParams('conv-1'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'read error' })
  })

  it('queries messages ordered by created_at ascending', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'conv-1' }, error: null })
    const messagesBuilder = makeQueryBuilder({ data: [], error: null })

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(messagesBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    await GET({} as Request, makeParams('conv-1'))

    expect(messagesBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(messagesBuilder.eq).toHaveBeenCalledWith('conversation_id', 'conv-1')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/chat/history/[id]
// ---------------------------------------------------------------------------
describe('DELETE /api/chat/history/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  async function importRoute() {
    return import('@/app/api/chat/history/[id]/route')
  }

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) }
  }

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    const res = await DELETE({} as Request, makeParams('conv-1'))

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('deletes conversation and returns ok: true', async () => {
    const { client, queryBuilder } = makeSupabaseMock({ queryResult: { data: null, error: null } })
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    const res = await DELETE({} as Request, makeParams('conv-to-delete'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(client.from).toHaveBeenCalledWith('chat_conversations')
    expect(queryBuilder.delete).toHaveBeenCalled()
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'conv-to-delete')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
  })

  it('returns 500 when delete query errors', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: { message: 'delete failed' } } })
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    const res = await DELETE({} as Request, makeParams('conv-1'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'delete failed' })
  })
})
