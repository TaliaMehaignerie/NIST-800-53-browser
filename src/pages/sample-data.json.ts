// Story 22: build-time endpoint for the bundled sample data. A backup envelope
// generated from the Content Collection (AD-8), fetched only when a visitor
// presses "See it with sample data". This project's `output: 'static'` makes it
// prerendered with every other route (AD-6).
import type { APIRoute } from 'astro';
import { buildSampleEnvelope } from '../utils/sampleEnvelope';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildSampleEnvelope()), {
    headers: { 'Content-Type': 'application/json' },
  });
