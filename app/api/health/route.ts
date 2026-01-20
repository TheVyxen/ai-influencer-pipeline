import { NextResponse } from 'next/server'

/**
 * Route de santé pour vérifier que l'API fonctionne
 * GET /api/health
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
