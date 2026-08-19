export const money=(n:number)=>`$${Math.max(0,Math.floor(n)).toLocaleString()}`;
export const randomMarketPrice=(current:number)=>Math.max(1,Math.floor(current*(.92+Math.random()*.16)));
