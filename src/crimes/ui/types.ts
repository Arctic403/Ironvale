import type React from "react";
import type { useRiftCity } from "../../hooks/useRiftCity";

export type CrimeGame = ReturnType<typeof useRiftCity>;
export type FeedbackMeta = { key:string; crimeId:string; subject:string; actionLabel:string; district?:string; label:string };
export type WithCrimeFeedback = (meta:FeedbackMeta, action:()=>void, onResolved?:()=>void)=>void;
export type FeedbackRenderer = (key:string)=>React.ReactNode;
