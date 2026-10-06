"use client"

import Link from "next/link"
import { MouseEvent } from "react"

type NavLinksProps = {
  sectionId :string
  children :React.ReactNode
  className ?:string
  onClick ?: () => void
}

export function NavLink({sectionId, children, className} : NavLinksProps) {
  const handleClick = (event :MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()

    const target = document.getElementById(sectionId)

    if (!target) return

    target.scrollIntoView({behavior: "smooth", block: "start"})

    window.history.replaceState(null, "", `#${sectionId}`)

  }
  return (
      <Link href={`#${sectionId}`} onClick={handleClick} className={className}>
        {children}
      </Link>
    )
}