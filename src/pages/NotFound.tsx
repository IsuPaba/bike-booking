import { Bike } from "lucide-react";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-tint text-primary"><Bike size={40} aria-hidden /></div>
      <p className="eyebrow mt-8">Error 404</p>
      <h1 className="h-display mt-2 text-6xl sm:text-7xl">Took a wrong turn</h1>
      <p className="mt-3 max-w-md text-lg text-ink-soft">This path leads nowhere, but the coastal road is lovely this time of day.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/">Back to home</ButtonLink>
        <ButtonLink to="/bicycles" variant="outline">See our bicycles</ButtonLink>
      </div>
    </div>
  );
}
