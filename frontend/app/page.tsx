import { UploadForm } from "@/components/UploadForm";
import { JobList } from "@/components/JobList";

export default function Home() {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Analyze a video
        </h1>
        <p className="text-sm text-neutral-500 mb-6 max-w-2xl">
          Upload a video to extract its digital features, connectivity capabilities,
          and UI flow (including how many interaction steps separate screens).
          The model decides the labels — no fixed taxonomy.
        </p>
        <UploadForm />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent jobs</h2>
        <JobList />
      </section>
    </div>
  );
}
