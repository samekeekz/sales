import { useEffect, useState } from "react"

export function useSlowLoading(isLoading: boolean, delayMs = 5000) {
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setIsSlow(false)
      return
    }

    const timer = setTimeout(() => {
      setIsSlow(true)
    }, delayMs)

    return () => clearTimeout(timer)
  }, [isLoading, delayMs])

  return isSlow
}

