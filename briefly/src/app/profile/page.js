import SidebarComponent from "@/components/SideBar";
import { cn } from "@/lib/utils";
import { auth0 } from "@/lib/auth0";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import EditPreferencesButton from "@/components/EditPreferencesButton";

export default async function ProfilePage() {
  const session = await auth0.getSession();
  const user = session?.user || null;

  if (!user) {
    return <div>You must be logged in to view this page.</div>;
  }

  return (
    <div
      className={cn(
        "rounded-md flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full flex-1 mx-auto border border-neutral-200 dark:border-neutral-700 overflow-hidden",
        "h-screen"
      )}
    >
      <SidebarComponent userProfile={user} />
      <div className="rounded-l-2xl w-full dark:bg-black bg-white dark:bg-grid-white/[0.1] bg-grid-black/[0.1] relative flex items-center justify-center">
        <div className="rounded-l-2xl absolute pointer-events-none inset-0 flex items-center justify-center dark:bg-black bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
        <div className="flex flex-col items-center">
          <Image
            src={user.picture}
            height={150}
            width={150}
            className="rounded-full"
            alt="Profile picture"
          />
          <div className="w-[30rem] mt-10">
            <LabelInputContainer className="mb-4">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder={user.nickname} type="text" />
            </LabelInputContainer>
            <LabelInputContainer className="mb-4">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" placeholder={user.email} type="email" />
            </LabelInputContainer>
            <div className="flex flex-col items-center mt-8">
              <EditPreferencesButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const LabelInputContainer = ({ children, className }) => {
  return (
    <div className={cn("flex flex-col space-y-2 w-full", className)}>
      {children}
    </div>
  );
};
