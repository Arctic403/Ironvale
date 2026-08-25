export const PROPERTY_REGISTRY = Object.freeze([
 {id:'shack',name:'Shack',description:'A tiny place to start your life in RiftCity.',price:0,bonuses:{maxHealth:0,nerve:0,happiness:100},upkeepPerDay:0,incomePerHour:0},
 {id:'apartment',name:'Small Apartment',description:'A basic place to call home.',price:5000,bonuses:{maxHealth:5,nerve:0,happiness:110},upkeepPerDay:20,incomePerHour:8},
 {id:'house',name:'Suburban House',description:'More space and a better environment.',price:25000,bonuses:{maxHealth:10,nerve:0,happiness:120},upkeepPerDay:60,incomePerHour:25},
 {id:'townhouse',name:'Luxury Townhouse',description:'A comfortable home for someone climbing the ladder.',price:100000,bonuses:{maxHealth:20,nerve:1,happiness:135},upkeepPerDay:180,incomePerHour:75},
 {id:'mansion',name:'City Mansion',description:'A serious statement of success.',price:500000,bonuses:{maxHealth:40,nerve:2,happiness:150},upkeepPerDay:650,incomePerHour:260}
]);
export const getPropertyDefinition=id=>PROPERTY_REGISTRY.find(property=>property.id===id)||null;
