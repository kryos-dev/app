import { useState } from "react"
import type { UIMessage } from "ai"

export const addUTM = (url: string) => {
  try {
    // Check if the URL is valid
    const u = new URL(url)
    // Ensure it's using HTTP or HTTPS protocol
    if (!["http:", "https:"].includes(u.protocol)) {
      return url // Return original URL for non-http(s) URLs
    }

    u.searchParams.set("utm_source", "zola.chat")
    u.searchParams.set("utm_medium", "research")
    return u.toString()
  } catch {
    // If URL is invalid, return the original URL without modification
    return url
  }
}

export const getFavicon = (url: string | null) => {
  if (!url) return null

  try {
    // Check if the URL is valid
    const urlObj = new URL(url)
    // Ensure it's using HTTP or HTTPS protocol
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return null
    }

    const domain = urlObj.hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    // No need to log errors for invalid URLs
    return null
  }
}

export const formatUrl = (url: string) => {
  try {
    return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
  } catch {
    return url
  }
}

export const getSiteName = (url: string) => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** Copy handler plus a short-lived "copied" flag for the check icon. */
export function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 500)
  }
  return { copied, copy }
}

/**
 * Whether a part draws anything. Empty reasoning, whitespace-only text and
 * bookkeeping parts do not.
 */
export const isVisiblePart = (part: UIMessage["parts"][number]) =>
  (part.type === "reasoning" && part.text.trim() !== "") ||
  part.type === "dynamic-tool" ||
  part.type.startsWith("tool-") ||
  (part.type === "text" && part.text.trim() !== "")
