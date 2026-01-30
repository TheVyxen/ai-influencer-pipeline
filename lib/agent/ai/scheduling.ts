/**
 * Service de scheduling intelligent
 * Calcule les horaires optimaux de publication Instagram
 */

import prisma from '@/lib/prisma'

export interface TimeSlot {
  hour: number      // 0-23
  minute: number    // 0 ou 30
  dayOfWeek?: number // 0-6 (dimanche-samedi), optionnel
}

export interface SchedulingResult {
  scheduledFor: Date
  reasoning: string
}

// Horaires par défaut basés sur les meilleures pratiques Instagram
const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { hour: 8, minute: 0 },   // Matin tôt
  { hour: 12, minute: 0 },  // Pause déjeuner
  { hour: 18, minute: 0 },  // Sortie du travail
  { hour: 20, minute: 30 }, // Soirée
]

// Heures de pointe par jour de la semaine (engagement plus élevé)
const PEAK_HOURS: Record<number, number[]> = {
  0: [10, 11, 17, 18],      // Dimanche
  1: [7, 8, 12, 19, 20],    // Lundi
  2: [7, 8, 12, 19, 20],    // Mardi
  3: [7, 8, 12, 19, 20, 21], // Mercredi (meilleur jour)
  4: [7, 8, 12, 17, 18],    // Jeudi
  5: [7, 8, 12, 17, 18, 19], // Vendredi
  6: [10, 11, 17, 18, 19],  // Samedi
}

/**
 * Parse les time slots depuis le JSON stocké en DB
 */
function parseTimeSlots(timeSlotsJson: string | null): TimeSlot[] {
  if (!timeSlotsJson) return DEFAULT_TIME_SLOTS

  try {
    const parsed = JSON.parse(timeSlotsJson)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(slot => ({
        hour: slot.hour || 12,
        minute: slot.minute || 0,
        dayOfWeek: slot.dayOfWeek
      }))
    }
  } catch {
    console.error('[Scheduling] Failed to parse time slots')
  }

  return DEFAULT_TIME_SLOTS
}

/**
 * Trouve le prochain créneau disponible pour une influenceuse
 */
export async function findNextSlot(
  influencerId: string,
  minDate?: Date
): Promise<SchedulingResult> {
  // Récupérer la config de l'influenceuse
  const influencer = await prisma.influencer.findUnique({
    where: { id: influencerId },
    include: { settings: true }
  })

  const postsPerDay = influencer?.settings?.postsPerDay ?? 1
  const timeSlots = parseTimeSlots(influencer?.settings?.timeSlots ?? null)

  // Récupérer les posts déjà programmés dans les 7 prochains jours
  const now = minDate || new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const scheduledPosts = await prisma.scheduledPost.findMany({
    where: {
      influencerId,
      scheduledFor: {
        gte: now,
        lte: weekFromNow
      },
      status: { in: ['scheduled', 'publishing'] }
    },
    select: { scheduledFor: true }
  })

  // Créer un set des dates déjà utilisées (au format YYYY-MM-DD HH:mm)
  const usedSlots = new Set(
    scheduledPosts.map(p => {
      const d = new Date(p.scheduledFor)
      return `${d.toISOString().split('T')[0]} ${d.getHours()}:${d.getMinutes()}`
    })
  )

  // Compter les posts par jour
  const postsPerDayCount: Record<string, number> = {}
  scheduledPosts.forEach(p => {
    const day = new Date(p.scheduledFor).toISOString().split('T')[0]
    postsPerDayCount[day] = (postsPerDayCount[day] || 0) + 1
  })

  // Chercher le prochain créneau disponible
  let searchDate = new Date(now)
  searchDate.setMinutes(0)
  searchDate.setSeconds(0)
  searchDate.setMilliseconds(0)

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const currentDate = new Date(searchDate.getTime() + dayOffset * 24 * 60 * 60 * 1000)
    const dayKey = currentDate.toISOString().split('T')[0]
    const dayOfWeek = currentDate.getDay()

    // Vérifier si on n'a pas atteint la limite de posts pour ce jour
    if ((postsPerDayCount[dayKey] || 0) >= postsPerDay) {
      continue
    }

    // Trier les time slots pour ce jour par priorité (heures de pointe d'abord)
    const peakHours = PEAK_HOURS[dayOfWeek] || []
    const sortedSlots = [...timeSlots].sort((a, b) => {
      const aIsPeak = peakHours.includes(a.hour)
      const bIsPeak = peakHours.includes(b.hour)
      if (aIsPeak && !bIsPeak) return -1
      if (!aIsPeak && bIsPeak) return 1
      return a.hour - b.hour
    })

    for (const slot of sortedSlots) {
      // Si le slot a un jour de semaine spécifique, vérifier
      if (slot.dayOfWeek !== undefined && slot.dayOfWeek !== dayOfWeek) {
        continue
      }

      const candidateDate = new Date(currentDate)
      candidateDate.setHours(slot.hour, slot.minute, 0, 0)

      // Vérifier que c'est dans le futur
      if (candidateDate <= now) {
        continue
      }

      // Vérifier que le slot n'est pas déjà pris
      const slotKey = `${dayKey} ${slot.hour}:${slot.minute}`
      if (usedSlots.has(slotKey)) {
        continue
      }

      // Créneau trouvé !
      const isPeakHour = peakHours.includes(slot.hour)
      return {
        scheduledFor: candidateDate,
        reasoning: isPeakHour
          ? `Créneau optimal : ${slot.hour}h${slot.minute.toString().padStart(2, '0')} est une heure de forte engagement le ${getDayName(dayOfWeek)}`
          : `Prochain créneau disponible : ${slot.hour}h${slot.minute.toString().padStart(2, '0')} le ${getDayName(dayOfWeek)}`
      }
    }
  }

  // Fallback : demain à 12h
  const fallbackDate = new Date(now)
  fallbackDate.setDate(fallbackDate.getDate() + 1)
  fallbackDate.setHours(12, 0, 0, 0)

  return {
    scheduledFor: fallbackDate,
    reasoning: 'Aucun créneau optimal disponible, programmé pour demain midi'
  }
}

/**
 * Planifie plusieurs posts de manière optimale
 */
export async function scheduleMultiplePosts(
  influencerId: string,
  count: number,
  startDate?: Date
): Promise<SchedulingResult[]> {
  const results: SchedulingResult[] = []
  let lastDate = startDate || new Date()

  for (let i = 0; i < count; i++) {
    const result = await findNextSlot(influencerId, lastDate)
    results.push(result)
    // Le prochain post doit être après celui-ci
    lastDate = new Date(result.scheduledFor.getTime() + 60000) // +1 minute
  }

  return results
}

function getDayName(dayOfWeek: number): string {
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  return days[dayOfWeek]
}
