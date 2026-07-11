import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
export const metadata:Metadata={title:"اخبار"};
const items=["ثبت‌نام جام جمعه FC 26 آغاز شد","قوانین جدید مسابقات هفت‌امتیازی","گزارش تصویری فینال هفته گذشته"];
export default function News(){return <div className="page-shell"><p className="section-kicker">NEWS</p><h1 className="section-title mt-2">اخبار و اطلاعیه‌ها</h1><div className="mt-8 grid gap-5 md:grid-cols-3">{items.map((x)=><Card key={x} className="p-6"><span className="text-xs text-[var(--brand)]"><CalendarDays size={14} className="ml-1 inline"/>تیر ۱۴۰۵</span><h2 className="mt-4 text-lg font-black">{x}</h2><p className="mt-3 text-sm leading-7 text-[var(--muted)]">این محتوای نمونه از پنل مدیریت قابل ویرایش و انتشار است.</p></Card>)}</div></div>}
