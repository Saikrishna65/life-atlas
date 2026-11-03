import { redirect } from "next/navigation";

export default function Page() {
  redirect("/secret/music/library?view=artists");
}

