import { requireUser } from "@/lib/auth";
import { CategoryFormPage } from "../CategoryFormPage";

export const metadata = { title: "Nieuwe categorie" };

export default async function NewCategory() {
  const user = await requireUser("editor");
  return <CategoryFormPage category={null} user={user} />;
}
