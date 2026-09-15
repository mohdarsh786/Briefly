import Recommendations from "./Recommendations";

export default function NewsCards({ selectedTags }) {
  return (
    <div className="flex flex-1 overflow-y-auto ">
      <div className="p-2 md:p-10 rounded-l-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col gap-2 flex-1 w-full h-full">
        <div className="flex justify-between hidden sm:block">
          <h1
            className={`font-[family-name:var(--font-alex-brush)] text-5xl text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-opacity-50`}
          >
            Shortly
          </h1>
        </div>
        <Recommendations selectedTags={selectedTags} />
      </div>
    </div>
  );
}
