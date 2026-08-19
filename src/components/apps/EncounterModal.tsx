import React from "react";
import type { useRiftCity } from "../../hooks/useRiftCity";

type RiftCityGame = ReturnType<typeof useRiftCity>;

type EncounterModalProps = {
  g: RiftCityGame;
};

export function EncounterModal({
  g,
}: EncounterModalProps) {
  if (!g.encounter) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <span className="modal-tag">
          RANDOM ENCOUNTER
        </span>

        <h2>
          {g.encounter.title}
        </h2>

        <p>
          {g.encounter.text}
        </p>

        <div className="modal-actions">
          {g.encounter.choices.map(
            (choice, index) => (
              <button
                className="btn-primary"
                key={index}
                onClick={() =>
                  g.chooseEncounter(choice)
                }
              >
                {choice.label}
              </button>
            )
          )}

          <button
            className="btn-secondary"
            onClick={() =>
              g.setEncounter(null)
            }
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
