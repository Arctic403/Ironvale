/**
 * Activity Logging Hook
 * Centralized activity writer to avoid nested setState calls
 */

import { SaveData, Activity, ActivityType } from "@/types/game";

export function useActivitySystem() {
  /**
   * Append an activity to the activity log.
   * Avoids nested setState calls.
   */
  const appendActivity = (
    state: SaveData,
    text: string,
    type: ActivityType = "system"
  ): SaveData => {
    const activity: Activity = {
      id: Date.now() + Math.random(),
      text,
      type,
      time: Date.now(),
    };

    return {
      ...state,
      activities: [activity, ...state.activities].slice(0, 60),
    };
  };

  return {
    appendActivity,
  };
}
