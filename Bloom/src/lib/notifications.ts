/** Thin wrapper around the Notification API that degrades gracefully. */

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

export function notificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as NotificationPermissionState
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (notificationPermission() === 'unsupported') return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    return result as NotificationPermissionState
  } catch {
    return 'denied'
  }
}

export async function showNotification(title: string, options: NotificationOptions & { tag?: string } = {}) {
  if (notificationPermission() !== 'granted') return false
  const opts: NotificationOptions = { icon: '/pwa-192.png', badge: '/pwa-192.png', ...options }
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.showNotification(title, opts)
        return true
      }
    }
    const n = new Notification(title, opts)
    return !!n
  } catch {
    return false
  }
}
