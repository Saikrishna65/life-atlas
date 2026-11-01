"use client";
import Image from 'next/image';
import { useState } from 'react';
import { merchantImageSource } from '@/lib/finance/merchantImages';
export default function MerchantImage({merchant,category='',direction='outflow',className=''}:{merchant:string;category?:string;direction?:string;className?:string}){
 const [failed,setFailed]=useState(false);
 return <span className={`finance-merchant-image ${className}`}><Image src={failed?'/finance/merchants/shopping.svg':merchantImageSource(merchant,category,direction)} width={29} height={29} alt="" unoptimized onError={()=>setFailed(true)}/></span>;
}
