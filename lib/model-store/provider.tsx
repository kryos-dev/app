"use client"

import { fetchClient } from "@/lib/fetch"
import { ModelConfig } from "@/lib/models/types"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

type ModelContextType = {
  models: ModelConfig[]
  favoriteModels: string[]
  isLoading: boolean
  refreshModels: () => Promise<void>
  refreshFavoriteModels: () => Promise<void>
  refreshFavoriteModelsSilent: () => Promise<void>
  refreshAll: () => Promise<void>
}

const ModelContext = createContext<ModelContextType | undefined>(undefined)

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [favoriteModels, setFavoriteModels] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchModels = useCallback(async () => {
    try {
      const response = await fetchClient("/api/models")
      if (response.ok) {
        const data = await response.json()
        setModels(data.models || [])
      }
    } catch (error) {
      console.error("Failed to fetch models:", error)
    }
  }, [])

  const fetchFavoriteModels = useCallback(async () => {
    try {
      const response = await fetchClient(
        "/api/user-preferences/favorite-models"
      )
      if (response.ok) {
        const data = await response.json()
        setFavoriteModels(data.favorite_models || [])
      }
    } catch (error) {
      console.error("Failed to fetch favorite models:", error)
      setFavoriteModels([])
    }
  }, [])

  const refreshModels = useCallback(async () => {
    setIsLoading(true)
    try {
      await fetchModels()
    } finally {
      setIsLoading(false)
    }
  }, [fetchModels])

  const refreshFavoriteModels = useCallback(async () => {
    setIsLoading(true)
    try {
      await fetchFavoriteModels()
    } finally {
      setIsLoading(false)
    }
  }, [fetchFavoriteModels])

  const refreshFavoriteModelsSilent = useCallback(async () => {
    try {
      await fetchFavoriteModels()
    } catch (error) {
      console.error(
        "❌ ModelProvider: Failed to silently refresh favorite models:",
        error
      )
    }
  }, [fetchFavoriteModels])

  const refreshAll = useCallback(async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        fetchModels(),
        fetchFavoriteModels(),
      ])
    } finally {
      setIsLoading(false)
    }
  }, [fetchModels, fetchFavoriteModels])

  // Initial data fetch
  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  return (
    <ModelContext.Provider
      value={{
        models,
        favoriteModels,
        isLoading,
        refreshModels,
        refreshFavoriteModels,
        refreshFavoriteModelsSilent,
        refreshAll,
      }}
    >
      {children}
    </ModelContext.Provider>
  )
}

// Custom hook to use the model context
export function useModel() {
  const context = useContext(ModelContext)
  if (context === undefined) {
    throw new Error("useModel must be used within a ModelProvider")
  }
  return context
}
