"use client"

import { useTheme } from "next-themes"
import { Toaster as SileoToaster } from "sileo"

const Toaster = () => {
  const { theme = "system" } = useTheme()

  return (
    <SileoToaster
      position="top-right"
      theme={theme as "light" | "dark" | "system"}
    />
  )
}

export { Toaster }
