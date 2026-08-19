import React from "react";
import type { useRiftCity } from "../../hooks/useRiftCity";

type RiftCityGame = ReturnType<typeof useRiftCity>;

type ActivityLogProps = {
  g: RiftCityGame;
};

export function ActivityLog({
  g,
}: ActivityLogProps) {
  return (
    <section className="card activity-card">
      <div className="card-header">
        <h3>Activity Log</h3>
      </div>

      <div className="activity-list">
        {g.gameState.activities
          .slice(0, 8)
          .map((activity) => (
            <div
              className={`activity-item ${activity.type}`}
              key={activity.id}
            >
              <span className="time">
                {new Date(
                  activity.time
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>

              <span className="type-tag">
                {activity.type.toUpperCase()}
              </span>

              <p className="desc">
                {activity.text}
              </p>
            </div>
          ))}
      </div>
    </section>
  );
}
