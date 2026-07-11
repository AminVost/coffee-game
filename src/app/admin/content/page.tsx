import { ContentManager } from "@/components/admin/content-manager";

export default function Content() {
  return <div>
    <p className="section-kicker">CONTENT MANAGEMENT</p>
    <h1 className="section-title mt-2">مدیریت محتوای صفحات</h1>
    <ContentManager/>
  </div>;
}
