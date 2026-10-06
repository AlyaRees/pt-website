"use client"

import { useState } from "react"
import { Menu, X, Dumbbell } from "lucide-react"
import { Button } from "./ui/Button"
import { NavLink } from "./NavLink"

const navLinks = [
  { href: "about", label: "About" },
  { href: "services", label: "Services" },
  { href: "pricing", label: "Pricing" },
  { href: "packages", label: "Packages" },
  { href: "schedule", label: "Schedule" },
  { href: "blog", label: "Blog" },
  { href: "testimonials", label: "Testimonials" },
]

export function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <NavLink sectionId="/" className="flex items-center gap-2">
            <Dumbbell className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold tracking-tight">Anton Archer</span>
          </NavLink>

          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                sectionId={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:block">
            <Button>
              <NavLink sectionId="booking">Book Now</NavLink>
            </Button>
          </div>

          <button
            className="lg:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden bg-background border-b border-border">
          <nav className="flex flex-col px-4 py-4 gap-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                sectionId={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
            <button className="mt-2">
              <NavLink sectionId="#booking" onClick={() => setIsOpen(false)}>Book Now</NavLink>
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}
