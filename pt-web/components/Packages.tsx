import { ArrowRight, Flame, Trophy, Rocket } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/Card"
import Link from "next/link"

const packages = [
  {
    icon: Flame,
    name: "6-Week Kickstart",
    price: "$499",
    description: "Perfect for beginners looking to establish a solid fitness foundation.",
    includes: [
      "12 personal training sessions",
      "Initial fitness assessment",
      "Customized workout plan",
      "Basic nutrition guide",
      "Weekly check-ins",
      "Access to workout app",
    ],
    savings: "Save $120",
  },
  {
    icon: Trophy,
    name: "12-Week Transformation",
    price: "$1,299",
    description: "Our most popular program for serious body transformation.",
    includes: [
      "36 personal training sessions",
      "Comprehensive assessment",
      "Progressive workout plan",
      "Full nutrition coaching",
      "Bi-weekly progress photos",
      "24/7 support access",
      "Body composition tracking",
    ],
    savings: "Save $380",
  },
  {
    icon: Rocket,
    name: "Competition Prep",
    price: "$2,499",
    description: "Elite 16-week program for competition or photoshoot preparation.",
    includes: [
      "48 personal training sessions",
      "Advanced periodization",
      "Competition nutrition plan",
      "Posing coaching",
      "Peak week protocols",
      "Daily check-ins",
      "Post-show reverse diet",
      "VIP priority scheduling",
    ],
    savings: "Save $580",
  },
]

export function Packages() {
  return (
    <section id="packages" className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-primary font-semibold tracking-wider uppercase text-sm mb-2">
            Packages
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-balance">
            Transformation Programs
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Commit to your goals with our comprehensive transformation packages. 
            Bundle and save while getting everything you need for success.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {packages.map((pkg) => (
            <Card key={pkg.name} className="bg-card border-border hover:border-primary/50 transition-colors relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-1 rounded">
                  {pkg.savings}
                </span>
              </div>
              <CardHeader>
                <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <pkg.icon className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-primary">{pkg.price}</span>
                </div>
                <CardDescription className="mt-2">{pkg.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-semibold mb-3 text-foreground">Includes:</p>
                <ul className="space-y-2">
                  {pkg.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <button className="w-full group">
                  <Link href="#booking">
                    Purchase Package
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
