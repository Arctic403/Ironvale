export const SHOP_REGISTRY = Object.freeze([
 {id:'corner-store',name:'Corner Store',locationId:'cornerstone-market',markup:1.15,buyback:.55,items:['energy_drink','candy_bar','first_aid_kit','ticket']},
 {id:'hardware',name:'Tool & Supply',locationId:'district-supply-co',markup:1.2,buyback:.5,items:['screwdriver']},
 {id:'pawn',name:'Pawn Counter',locationId:'second-chance-exchange',markup:1.25,buyback:.7,items:['cheap_watch','knife']}
]);
export const getShopDefinition=id=>SHOP_REGISTRY.find(shop=>shop.id===id)||null;
