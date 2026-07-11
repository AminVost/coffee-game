"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chrome, KeyRound, LoaderCircle, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@coffeegame.local");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"password" | "sms">("password");

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) return setError(data.message || "ورود انجام نشد");
    router.push(data.role === "admin" ? "/admin" : "/account"); router.refresh();
  }

  async function smsLogin(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/sms/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile: email, code: password }) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) return setError(data.message || "کد تایید نادرست است");
    router.push("/account"); router.refresh();
  }

  return <div>
    <div className="mb-6 grid grid-cols-2 rounded-2xl bg-[var(--surface-2)] p-1"><button onClick={() => { setTab("password"); setEmail("admin@coffeegame.local"); setPassword("Admin@123"); }} className={`cursor-pointer rounded-xl px-3 py-2.5 text-sm font-bold ${tab === "password" ? "bg-[var(--surface)] shadow" : "text-[var(--muted)]"}`}><KeyRound size={15} className="ml-1 inline"/>رمز عبور</button><button onClick={() => { setTab("sms"); setEmail("09120000000"); setPassword("123456"); }} className={`cursor-pointer rounded-xl px-3 py-2.5 text-sm font-bold ${tab === "sms" ? "bg-[var(--surface)] shadow" : "text-[var(--muted)]"}`}><MessageSquareText size={15} className="ml-1 inline"/>کد پیامکی</button></div>
    <form onSubmit={tab === "password" ? submit : smsLogin} className="grid gap-4">
      <label className="field-label">{tab === "password" ? "ایمیل یا موبایل" : "شماره موبایل"}<input className="field" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" required /></label>
      <label className="field-label">{tab === "password" ? "رمز عبور" : "کد تایید آزمایشی"}<input className="field" type={tab === "password" ? "password" : "text"} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" required /></label>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-500">{error}</p>}
      <Button type="submit" className="w-full">{loading && <LoaderCircle size={18} className="animate-spin"/>}{tab === "password" ? "ورود به حساب" : "تایید و ورود"}</Button>
    </form>
    <div className="my-5 flex items-center gap-3 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--line)]"/>یا<span className="h-px flex-1 bg-[var(--line)]"/></div>
    <Button variant="secondary" className="w-full" type="button" disabled><Chrome size={18}/>ورود با Google — پس از ثبت کلیدها</Button>
    <p className="mt-5 rounded-2xl bg-amber-500/10 p-3 text-xs leading-6 text-amber-600">حساب مدیر آزمایشی از قبل وارد شده است. ورود پیامکی در حالت Mock با کد ۱۲۳۴۵۶ انجام می‌شود.</p>
  </div>;
}
