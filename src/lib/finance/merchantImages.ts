export function merchantImageSource(merchant:string,category='',direction='outflow'){
 const name=merchant.toLowerCase();
 if(/\bswiggy\b/.test(name))return '/finance/merchants/swiggy.svg';
 if(/\buber\b/.test(name))return '/finance/merchants/uber.svg';
 if(/\bnetflix\b/.test(name))return '/finance/merchants/netflix.svg';
 if(/big\s*basket/.test(name))return '/finance/merchants/bigbasket.svg';
 const context=`${name} ${category.toLowerCase()}`;
 const kind=direction==='inflow'?'income':/rent|housing|home/.test(context)?'home':/grocer|market/.test(context)?'grocery':/food|dining|cafe|restaurant/.test(context)?'food':/transport|fuel|taxi|travel/.test(context)?'transport':/health|medical|pharmacy/.test(context)?'health':/bill|utilit|electric/.test(context)?'bills':'shopping';
 return `/finance/merchants/${kind}.svg`;
}
