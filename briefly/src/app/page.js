import React from "react";
import { auth0 } from "@/lib/auth0";
import DefaultHome from "../components/DefaultHome";
import NewsApp from "../components/NewsApp";

export default async function Home() {
  const session = await auth0.getSession();
  const user = session?.user || null;

  return (
    <div className={`${user ? "h-full" : "h-screen"} "w-full rounded-md flex items-center justify-center bg-black/[0.96] antialiased bg-grid-white/[0.02] relative overflow-hidden`}>
      {user ? <NewsApp user={user} /> : <DefaultHome />}
    </div>
  );
}
