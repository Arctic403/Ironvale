export const formatTime=(ms:number)=>{const s=Math.ceil(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`};
export const timeLeft=(until:number|null)=>until?Math.max(0,until-Date.now()):0;
