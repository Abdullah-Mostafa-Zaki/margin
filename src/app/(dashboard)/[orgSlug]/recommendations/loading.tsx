export default function RecommendationsLoading() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 overflow-y-auto pb-24 animate-pulse">
      <div className="mb-8">
        <div className="h-9 w-48 bg-zinc-200 rounded-md mb-2"></div>
        <div className="h-5 w-64 bg-zinc-100 rounded-md mt-2"></div>
      </div>
      
      {/* GodMetric Skeleton */}
      <div className="h-32 w-full bg-zinc-200 rounded-xl mb-6"></div>
      
      {/* Insights Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="h-64 w-full bg-zinc-100 rounded-xl"></div>
        <div className="h-64 w-full bg-zinc-100 rounded-xl"></div>
        <div className="h-64 w-full bg-zinc-100 rounded-xl"></div>
        <div className="h-64 w-full bg-zinc-100 rounded-xl"></div>
      </div>
    </div>
  );
}
