import type { Metadata } from "next";
import Image from "next/image";
export const metadata:Metadata={title:"گالری"};
const images=["/brand/logo-dark.png","/brand/logo-light.png","/brand/logo-concept-full.png","/brand/logo-dark.png","/brand/logo-light.png","/brand/logo-concept-full.png"];
export default function Gallery(){return <div className="page-shell"><p className="section-kicker">GALLERY</p><h1 className="section-title mt-2">گالری مسابقات و قهرمانان</h1><p className="mt-3 text-sm text-[var(--muted)]">نمونه اولیه گالری؛ تصاویر واقعی مجموعه از پنل مدیریت جایگزین می‌شوند.</p><div className="mt-8 grid auto-rows-[220px] gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((src,i)=><div key={i} className={`relative overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] ${i===2?"sm:row-span-2":""}`}><Image src={src} alt="گالری Coffee Game" fill className="object-cover transition duration-500 hover:scale-105"/></div>)}</div></div>}
