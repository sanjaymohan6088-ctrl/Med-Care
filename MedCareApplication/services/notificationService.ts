import { Capacitor } from '@capacitor/core';
import { LocalNotifications as CapacitorLocalNotifications } from '@capacitor/local-notifications';
import { db, auth } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { PatientRecord } from '../types';

// --- WEB MOCK FOR PREVIEW ---
// Simulates the Capacitor Local Notifications plugin
const LocalNotificationsMock = {
  schedule: async (options: any) => {
    console.log("🔔 [NATIVE OS SCHEDULER] Registered Future Alarms:", options.notifications.map((n: any) => 
      `\n  ➡️ [ID: ${n.id}] ${n.schedule.at.toLocaleString()} | ${n.title}`
    ));
    return { notifications: [] };
  },
  registerActionTypes: async (options: any) => {
    console.log("🔔 [NATIVE OS] Action Types Registered (Taken/Missed)");
  },
  addListener: (eventName: string, callback: Function) => {
    console.log(`🔔 [NATIVE OS] Listener Active for: ${eventName}`);
    return { remove: () => {} };
  },
  checkPermissions: async () => ({ display: 'granted' }),
  requestPermissions: async () => ({ display: 'granted' })
};

// Switch to real plugin when running inside the Capacitor shell
const isNativePlatform = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
})();

const LocalNotifications = isNativePlatform
  ? CapacitorLocalNotifications
  : LocalNotificationsMock;

export const initializeNotificationListeners = async () => {
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return;

  if (isNativePlatform && Capacitor.getPlatform() === 'android') {
    // Delete existing channel if it exists (to reset sound settings)
    // This is important because Android channels can't be easily modified once created
    try {
      await LocalNotifications.deleteChannel?.({ id: 'medication_reminders' });
      // Small delay to ensure channel is deleted
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (e) {
      // Channel might not exist, that's okay
    }
    
    // Create notification channel for medication reminders
    // On Android 8.0+, sound is controlled by the notification channel
    // Setting importance to 5 (URGENT) ensures sound plays even in Do Not Disturb mode
    // IMPORTANT: For sound to work, you need to either:
    // 1. Add a custom sound file to android/app/src/main/res/raw/ (see ANDROID_SOUND_SETUP.md)
    // 2. Or ensure device notification volume is up and channel settings allow sound
    await LocalNotifications.createChannel?.({
      id: 'medication_reminders',
      name: 'Medication Reminders',
      description: 'Persistent alarms to remind patients to take tablets',
      importance: 5, // MAX importance (URGENT) - ensures sound plays and bypasses Do Not Disturb
      // If you added a custom sound file (e.g., alarm_beep.wav), use: sound: 'alarm_beep'
      // Otherwise, use null to let Android use system default (may not always work)
      sound: null, // Change to 'alarm_beep' if you add a custom sound file
      vibration: true,
      visibility: 1, // Public visibility
      lights: true,
      lightColor: '#FF0000'
    });
  }

  // Register interactive buttons for the lock screen
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: 'GROUP_MEDICATION_ACTION',
        actions: [
          { id: 'taken_all', title: 'Taken All', foreground: false }, // Background action
          { id: 'missed_all', title: 'Missed', foreground: false, destructive: true }
        ]
      }
    ]
  });

  // Handle interactions (even from background)
  LocalNotifications.addListener('localNotificationActionPerformed', async (notificationAction) => {
    const { actionId, notification } = notificationAction;
    console.log(`🔔 User Tapped '${actionId}' on Notification ${notification.id}`);
    
    // Extract metadata
    const { recordId, timeLabel } = notification.extra;
    
    if (auth.currentUser && recordId) {
        // Log to Firestore directly from background
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const logRef = doc(db, "users", auth.currentUser.uid, "adherence", todayStr);
            
            const status = actionId === 'taken_all' ? 'Taken' : 'Missed';
            // Key format: "morning" or "night" based on timeLabel
            const slotKey = timeLabel.toLowerCase().split(' ')[0]; 

            await updateDoc(logRef, {
                [slotKey]: status
            });
            console.log(`✅ Firestore updated: ${slotKey} -> ${status}`);
        } catch (e) {
            console.error("❌ Background Sync Failed", e);
        }
    }
  });
};

export const scheduleMedicationAlarms = async (record: PatientRecord) => {
  console.log("⏰ calculating future alarms for OS scheduling...");
  
  const startDate = new Date();
  const durationDays = 7; // Hardcoded duration or parse from record

  // 1. Identify which slots are needed for this prescription
  let hasMorning = false;
  let hasAfternoon = false;
  let hasNight = false;
  
  const morningMeds: string[] = [];
  const afternoonMeds: string[] = [];
  const nightMeds: string[] = [];

  record.medicines.forEach(med => {
    const freq = med.frequency.toLowerCase().replace(/\s/g, '');
    const label = `${med.med_name} (${med.dose})`;

    if (freq.includes('1-1-1') || freq.includes('tds') || freq.includes('tid')) {
        hasMorning = true; hasAfternoon = true; hasNight = true;
        morningMeds.push(label); afternoonMeds.push(label); nightMeds.push(label);
    } else if (freq.includes('1-0-1') || freq.includes('bd') || freq.includes('bid')) {
        hasMorning = true; hasNight = true;
        morningMeds.push(label); nightMeds.push(label);
    } else if (freq.includes('1-0-0') || freq.includes('od') || freq === 'morning') {
        hasMorning = true;
        morningMeds.push(label);
    } else if (freq.includes('0-0-1') || freq === 'night') {
        hasNight = true;
        nightMeds.push(label);
    } else {
        hasMorning = true; // Default
        morningMeds.push(label);
    }
  });

  const notifications = [];

  // 2. Loop through every day of the duration and create a specific alarm object
  for (let i = 0; i < durationDays; i++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + i);

    // Morning Alarm (8:00 AM)
    if (hasMorning) {
        const alarmTime = new Date(dayDate);
        alarmTime.setHours(8, 0, 0, 0);
        
        // Only schedule if it's in the future
        if (alarmTime.getTime() > Date.now()) {
            notifications.push({
                id: Math.floor(Math.random() * 100000000), // Unique ID for OS
                title: "Morning Medicines",
                body: `Take: ${morningMeds.join(', ')}`,
                schedule: { at: alarmTime, allowWhileIdle: true }, // Absolute time
                actionTypeId: 'GROUP_MEDICATION_ACTION', // Adds Taken/Missed buttons
                extra: { recordId: record.id, timeLabel: 'Morning' },
                smallIcon: 'ic_stat_medicine',
                channelId: 'medication_reminders',
                // Don't set sound - let the channel handle it
                // The channel's high importance (5) will ensure sound plays
            });
        }
    }

    // Afternoon Alarm (1:30 PM)
    if (hasAfternoon) {
        const alarmTime = new Date(dayDate);
        alarmTime.setHours(13, 30, 0, 0);
        
        if (alarmTime.getTime() > Date.now()) {
            notifications.push({
                id: Math.floor(Math.random() * 100000000),
                title: "Afternoon Medicines",
                body: `Take: ${afternoonMeds.join(', ')}`,
                schedule: { at: alarmTime, allowWhileIdle: true },
                actionTypeId: 'GROUP_MEDICATION_ACTION',
                extra: { recordId: record.id, timeLabel: 'Afternoon' },
                smallIcon: 'ic_stat_medicine',
                channelId: 'medication_reminders'
            });
        }
    }

    // Night Alarm (9:00 PM)
    if (hasNight) {
        const alarmTime = new Date(dayDate);
        alarmTime.setHours(21, 0, 0, 0);
        
        if (alarmTime.getTime() > Date.now()) {
            notifications.push({
                id: Math.floor(Math.random() * 100000000),
                title: "Night Medicines",
                body: `Take: ${nightMeds.join(', ')}`,
                schedule: { at: alarmTime, allowWhileIdle: true },
                actionTypeId: 'GROUP_MEDICATION_ACTION',
                extra: { recordId: record.id, timeLabel: 'Night' },
                smallIcon: 'ic_stat_medicine',
                channelId: 'medication_reminders'
            });
        }
    }
  }

  // 3. Bulk Register with Native OS
  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
    console.log(`✅ OS Scheduler: ${notifications.length} alarms set.`);
  }
};