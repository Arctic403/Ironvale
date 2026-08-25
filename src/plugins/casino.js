// Fictional RiftCity casino configuration. Uses in-game chips only; never real money.
export const CASINO_GAMES = Object.freeze([
 {id:'blackjack',name:'Blackjack',status:'active',minBet:1,maxBet:25,description:'Quick head-to-head card round.'},
 {id:'roulette',name:'Roulette',status:'active',minBet:1,maxBet:25,description:'Single-spin wheel round.'},
 {id:'baccarat',name:'Baccarat',status:'active',minBet:1,maxBet:25,description:'Fast banker/player style round.'},
 {id:'craps',name:'Craps',status:'active',minBet:1,maxBet:25,description:'Single-round dice table.'},
 {id:'war',name:'Casino War',status:'active',minBet:1,maxBet:25,description:'High-card table round.'},
 {id:'slots',name:'Slots',status:'active',minBet:1,maxBet:20,description:'Animated multi-reel machine.'},
 {id:'horse-racing',name:'Horse Racing',status:'active',minBet:1,maxBet:20,description:'Timed fictional race ticket.'},
 {id:'poker',name:'Hold’em Table',status:'active',minBet:2,maxBet:25,description:'Server-resolved table showdown foundation.'}
]);
export const DAILY_CHIP_GRANT=75;
