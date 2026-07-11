/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
    <Card className="h-fit p-3">
      {pages.map((page) => <Button key={page.slug} type="button" onClick={() => setSlug(page.slug)} variant={page.slug === slug ? "primary" : "ghost"} className="mb-1 w-full justify-start">{page.title}</Button>)}
    </Card>
    <Card className="p-6">
      {loading && <p className="text-sm text-[var(--muted)]">در حال دریافت محتوا...</p>}
      {!loading && content && <>
        <h2 className="text-xl font-black">ویرایش {pages.find((page) => page.slug === slug)?.title}</h2>
        <div className="mt-6 grid gap-5">
          <Label>عنوان<Input value={content.title} onChange={(event) => update("title", event.target.value)} /></Label>
          <Label>محتوا<Textarea className="min-h-80" value={content.body} onChange={(event) => update("body", event.target.value)} /></Label>
          <Label>عنوان SEO<Input value={content.seoTitle} onChange={(event) => update("seoTitle", event.target.value)} /></Label>
          <Label>توضیح SEO<Textarea value={content.seoDescription} onChange={(event) => update("seoDescription", event.target.value)} /></Label>
          <Label>وضعیت انتشار<SelectField value={content.isPublished ? "published" : "draft"} onValueChange={(value) => update("isPublished", value === "published")} options={[{ value: "published", label: "منتشرشده" }, { value: "draft", label: "پیش‌نویس" }]} /></Label>
          {message && <Alert tone="success">{message}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}
          <Button className="w-fit" type="button" onClick={save} loading={saving} loadingText="در حال ذخیره"><Save size={17} />ذخیره تغییرات</Button>
        </div>
      </>}
    </Card>
  </div>;
}
