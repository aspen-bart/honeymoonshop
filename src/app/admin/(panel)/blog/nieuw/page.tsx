import { requireUser } from "@/lib/auth";
import { BlogFormPage } from "../BlogFormPage";

export const metadata = { title: "Nieuwe blog" };

export default async function NewPost() {
  const user = await requireUser("editor");
  return <BlogFormPage post={null} user={user} />;
}
