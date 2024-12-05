import LogInSignUpButton from "./LogInSignUpButton";
import { Spotlight } from "./ui/spotlight";

export default function DefaultHome() {
  return (
    <div>
      <Spotlight
        className="top-12 left-0 md:left-60 md:-top-20"
        fill="white"
      />
      <div className=" p-4 max-w-7xl  mx-auto relative z-10  w-full pt-20 md:pt-0">
        <h1
          className={`font-[family-name:var(--font-alex-brush)] text-9xl text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-opacity-50`}
        >
          Shorts
        </h1>
        <div className="flex justify-center mt-8">
          <LogInSignUpButton />
        </div>
      </div>
    </div>
  );
}
