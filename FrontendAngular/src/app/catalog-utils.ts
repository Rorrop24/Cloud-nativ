import type { Product } from './api.service';
export const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
export function finalPrice(product:Product):number {
  const discount=Math.min(100,Math.max(0,product.descuento??0));
  return Math.round(product.precio*(1-discount/100)*100)/100;
}
export function selectProducts(products:Product[],query:string,category:string,inStock:boolean,sort:string):Product[] {
  const terms=normalize(query.trim()).split(/\s+/).filter(Boolean);
  const filtered=products.filter(p=>terms.every(t=>normalize(p.nombre+' '+p.id+' '+(p.categoria?.nombre??'')).includes(t))
    &&(!category||p.categoria?.nombre===category)&&(!inStock||p.stock>0));
  if(sort==='price-asc')filtered.sort((a,b)=>finalPrice(a)-finalPrice(b));
  if(sort==='price-desc')filtered.sort((a,b)=>finalPrice(b)-finalPrice(a));
  if(sort==='name')filtered.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  return filtered;
}
export function productArt(product:Product):string {
  const name=normalize(product.nombre+' '+(product.categoria?.nombre??''));
  const kind=/teclado|keyboard/.test(name)?'keyboard':/mouse|raton/.test(name)?'mouse':/audifono|headset|auricular/.test(name)?'headset':'controller';
  return '/assets/'+kind+'.svg';
}
