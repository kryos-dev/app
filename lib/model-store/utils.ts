import { ModelConfig } from "@/lib/models/types"

/**
 * Utility function to filter and sort models based on favorites, search, and visibility
 * @param models - All available models
 * @param favoriteModels - Array of favorite model IDs
 * @param searchQuery - Search query to filter by model name
 * @param isModelHidden - Function to check if a model is hidden
 * @returns Filtered and sorted models
 */
export function filterAndSortModels(
  models: ModelConfig[],
  favoriteModels: string[],
  searchQuery: string,
  isModelHidden: (modelId: string) => boolean
): ModelConfig[] {
  return models
    .filter((model) => !isModelHidden(model.id))
    // Favourites used to FILTER: once any model was starred, every other lane
    // disappeared from the picker. A lane added later could then never be
    // reached, because a lane nobody has starred yet is exactly the lane that
    // is new. Starring now only lifts a lane to the top.
    .filter((model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Favourites first, in the order they were starred; everything else
      // after, alphabetically, so the list is stable as lanes come and go.
      const ai = favoriteModels?.indexOf(a.id) ?? -1
      const bi = favoriteModels?.indexOf(b.id) ?? -1
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.name.localeCompare(b.name)
    })
}
