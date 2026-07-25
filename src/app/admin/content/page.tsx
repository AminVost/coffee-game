import { ContentManager } from "@/components/admin/content-manager";
import { NewsGalleryManager } from "@/components/admin/news-gallery-manager";
import { requireAdminPage } from "@/lib/page-authorization";

export default async function Content() {
  await requireAdminPage("content.manage");
  return <div>
    <p className="section-kicker">CONTENT MANAGEMENT</p>
    <h1 className="section-title mt-2">مدیریت محتوای صفحات</h1>
    <ContentManager/><NewsGalleryManager/>
  </div>;
}
