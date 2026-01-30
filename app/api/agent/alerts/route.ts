import { NextRequest, NextResponse } from 'next/server'
import {
  getUnreadAlerts,
  getRecentAlerts,
  markAlertAsRead,
  resolveAlert,
  markAllAlertsAsRead,
  cleanupOldAlerts
} from '@/lib/monitoring/alerts'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agent/alerts
 * Récupère les alertes
 *
 * Query params:
 * - type: 'unread' | 'recent' (défaut: unread)
 * - influencerId: string (optionnel)
 * - days: number (pour recent, défaut: 7)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'unread'
    const influencerId = searchParams.get('influencerId') || undefined
    const days = parseInt(searchParams.get('days') || '7')

    let alerts

    if (type === 'unread') {
      alerts = await getUnreadAlerts(influencerId)
    } else if (type === 'recent') {
      alerts = await getRecentAlerts(days, influencerId)
    } else {
      return NextResponse.json(
        { error: 'Invalid type parameter' },
        { status: 400 }
      )
    }

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('[Alerts API] Error fetching alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/agent/alerts
 * Met à jour une alerte (marquer comme lue ou résolue)
 *
 * Body:
 * - action: 'read' | 'resolve' | 'readAll'
 * - alertId: string (requis pour read et resolve)
 * - influencerId: string (optionnel pour readAll)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, alertId, influencerId } = body

    switch (action) {
      case 'read':
        if (!alertId) {
          return NextResponse.json(
            { error: 'alertId is required' },
            { status: 400 }
          )
        }
        await markAlertAsRead(alertId)
        return NextResponse.json({ success: true, message: 'Alert marked as read' })

      case 'resolve':
        if (!alertId) {
          return NextResponse.json(
            { error: 'alertId is required' },
            { status: 400 }
          )
        }
        await resolveAlert(alertId)
        return NextResponse.json({ success: true, message: 'Alert resolved' })

      case 'readAll':
        const count = await markAllAlertsAsRead(influencerId)
        return NextResponse.json({ success: true, count, message: `${count} alerts marked as read` })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[Alerts API] Error updating alert:', error)
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/agent/alerts
 * Nettoie les anciennes alertes résolues
 *
 * Query params:
 * - daysOld: number (défaut: 30)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const daysOld = parseInt(searchParams.get('daysOld') || '30')

    const count = await cleanupOldAlerts(daysOld)

    return NextResponse.json({
      success: true,
      deleted: count,
      message: `${count} old alerts deleted`
    })
  } catch (error) {
    console.error('[Alerts API] Error cleaning up alerts:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup alerts' },
      { status: 500 }
    )
  }
}
