/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type PageSlug = "home" | "rules" | "about" | "contact";
type PageContent = { slug: PageSlug; title: string; body: string; seoTitle: string; seoDescription: string; isPublished: boolean };
const pages: Array<{ slug: PageSlug; title: string }> = [
  { slug: "home", title: "صفحه اصلی" },
  { slug: "rules", title: "قوانین" },
  { slug: "about", title: "درباره ما" },
  { slug: "contact", title: "تماس با ما" }
];

export function ContentManager() {
  const [slug, setSlug] = useState<PageSlug>("rules");
  const [content, setContent] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch(`/api/admin/content?slug=${slug}`, { cache: "no-store" })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!active) return;
        setLoading(false);
        if (!response.ok) return setError(payload.message || "دریافت محتوا انجام نشد.");
        setContent(payload.item);
      })
      .catch(() => active && setError("دریافت محتوا انجام نشد."));
    return () => { active = false; };
  }, [slug]);

  function update<K extends keyof PageContent>(key: K, value: PageContent[K]) {
    setContent((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!content) return;
    setSaving(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content)
    });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) return setError(payload.message || "ذخیره محتوا انجام نشد.");
    setMessage("تغییرات با موفقیت ذخیره شد.");
  }

  return <div className="mt-7 grid gap-6 xl:grid-cols-[260px_1fr]">
    <Card className="h-fit p-3">{pages.map((page) => <button key={page.slug} onClick={() => setSlug(page.slug)} className={`block w-full cursor-pointer rounded-xl px-4 py-3 text-right text-sm font-bold ${page.slug === slug ? "bg-[var(--brand)] text-white" : "hover:bg-[var(--surface-2)]"}`}>{page.title}</button>)}</Card>
    <Card className="p-6">
      {loading && <p className="text-sm text-[var(--muted)]">در حال دریافت محتوا...</p>}
      {!loading && content && <>
        <h2 className="text-xl font-black">ویرایش {pages.find((page) => page.slug === slug)?.title}</h2>
        <div className="mt-6 grid gap-5">
          <label className="field-label">عنوان<input className="field" value={content.title} onChange={(event) => update("title", event.target.value)}/></label>
          <label className="field-label">محتوا<textarea className="field min-h-80" value={content.body} onChange={(event) => update("body", event.target.value)}/></label>
          <label className="field-label">عنوان SEO<input className="field" value={content.seoTitle} onChange={(event) => update("seoTitle", event.target.value)}/></label>
          <label className="field-label">توضیح SEO<textarea className="field" value={content.seoDescription} onChange={(event) => update("seoDescription", event.target.value)}/></label>
          <label className="field-label">وضعیت انتشار<select className="field" value={content.isPublished ? "published" : "draft"} onChange={(event) => update("isPublished", event.target.value === "published")}><option value="published">منتشرشده</option><option value="draft">پیش‌نویس</option></select></label>
          {message && <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-600">{message}</p>}
          {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
          <Button className="w-fit" onClick={save} disabled={saving}><Save size={17}/>{saving ? "در حال ذخیره" : "ذخیره تغییرات"}</Button>
        </div>
      </>}
    </Card>
  </div>;
}
