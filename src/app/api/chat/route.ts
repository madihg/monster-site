import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Your monster lives in the studio. Three values, set in Vercel under
// Settings > Environment Variables, point this site at it:
//   MONSTER_BASE_URL  the studio's address for programs (ends in /api/v1)
//   MONSTER_API_KEY   your secret key (starts with sk_mon_)
//   MONSTER_MODEL     your monster's model name
// The key stays on the server. The browser only talks to /api/chat.

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const baseURL = process.env.MONSTER_BASE_URL;
  const apiKey = process.env.MONSTER_API_KEY;
  const model = process.env.MONSTER_MODEL;
  if (!baseURL || !apiKey || !model) {
    return NextResponse.json(
      {
        error:
          'This site is missing MONSTER_BASE_URL, MONSTER_API_KEY or MONSTER_MODEL. Add them in Vercel (Settings > Environment Variables), then redeploy.',
      },
      { status: 500 }
    );
  }

  try {
    const { messages } = await request.json();

    const openai = new OpenAI({
      baseURL,
      apiKey,
      // The web fetch, so the stream can be passed straight on to the browser.
      fetch: globalThis.fetch,
      maxRetries: 0,
    });

    // stream: true. The studio answers with server-sent events: tokens as they
    // come, an "event: waking" while the monster wakes up, then [DONE].
    const upstream = await openai.chat.completions
      .create({ model, messages, stream: true })
      .asResponse();

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Monster API error:', error);
    const status =
      error instanceof OpenAI.APIError && typeof error.status === 'number'
        ? error.status
        : 500;
    const message =
      error instanceof OpenAI.APIError && error.message
        ? error.message
        : 'Failed to process your request';
    return NextResponse.json({ error: message }, { status });
  }
}
