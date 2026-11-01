import { requireUser } from "@/lib/auth";
import { ReviewFormPage } from "../ReviewFormPage";

export const metadata = { title: "Nieuwe review" };

export default async function NewReview() {
  const user = await requireUser("editor");
  return <ReviewFormPage review={null} user={user} />;
}
