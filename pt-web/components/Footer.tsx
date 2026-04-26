import Link from "next/link"
import { Dumbbell } from "lucide-react"
import { FaInstagram, FaFacebook, FaYoutube, FaTwitter } from "react-icons/fa"

const footerLinks = {
  services: [
    { label: "Personal Training", href: "#services" },
    { label: "Group Training", href: "#services" },
    { label: "Online Coaching", href: "#services" },
    { label: "Nutrition Coaching", href: "#services" },
  ],
  company: [
    { label: "About", href: "#about" },
    { label: "Schedule", href: "#schedule" },
    { label: "Blog", href: "#blog" },
    { label: "Testimonials", href: "#testimonials" },
  ],
  legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Refund Policy", href: "#" },
  ],
}

const socialLinks = [
  { icon: FaInstagram, href: "#", label: "Instagram" },
  { icon: FaFacebook, href: "#", label: "Facebook" },
  { icon: FaYoutube, href: "#", label: "YouTube" },
  { icon: FaTwitter, href: "#", label: "Twitter" },
]

export function Footer() {
  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Dumbbell className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold tracking-tight">ALEX CARTER</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Transforming lives through personalized fitness coaching. 
              Your journey to a healthier, stronger you starts here.
            </p>
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="h-5 w-5" />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Services</h3>
            <ul className="space-y-3">
              {footerLinks.services.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Alex Carter Fitness. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Designed with dedication for your fitness journey.
          </p>
        </div>
      </div>
    </footer>
  )
}
