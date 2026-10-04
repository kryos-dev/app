import { Shimmer } from "@/components/ai-elements/shimmer"

// Assistant "thinking" indicator, shown before the first assistant part
// streams in. The shimmering word IS the animation -- a spinner next to it
// says the same thing twice and is the part that reads as cheap.
//
// It has to be pixel-identical to WorkGroup's live header, because the moment
// the first reasoning part arrives this is unmounted and that row takes over
// in the same place. They used to disagree: "Thinking…" at `text-13` with no
// row padding, replaced by "Thinking" at `text-sm` inside a `py-1` flex row.
// Same word, different size and different baseline, so it visibly jumped and
// read as the label being shown twice.
//
// Keep these two in step: see `liveLabel` in work-group.tsx.
export function Loader() {
  return (
    <div className="text-muted-foreground flex items-center gap-1 py-1 text-left text-sm">
      <Shimmer as="span">Thinking</Shimmer>
    </div>
  )
}
