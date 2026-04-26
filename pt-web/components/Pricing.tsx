import { Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/Card"
import Link from "next/link"

const pricingTiers = [
  {
    name: "Single Session",
    price: "$85",
    period: "per session",
    description: "Perfect for trying out personal training",
    features: [
      "60-minute training session",
      "Personalized workout",
      "Form correction & guidance",
      "Progress tracking",
    ],
    popular: false,
  },
  {
    name: "Monthly Basic",
    price: "$320",
    period: "per month",
    description: "Ideal for consistent weekly training",
    features: [
      "4 sessions per month",
      "Customized training program",
      "Nutrition guidelines",
      "Email support",
      "Monthly progress review",
    ],
    popular: false,
  },
  {
    name: "Monthly Pro",
    price: "$580",
    period: "per month",
    description: "Comprehensive training & support",
    features: [
      "8 sessions per month",
      "Advanced training program",
      "Full nutrition plan",
      "24/7 messaging support",
      "Bi-weekly progress review",
      "Supplement guidance",
    ],
    popular: true,
  },
  {
    name: "Elite",
    price: "$950",
    period: "per month",
    description: "Ultimate transformation package",
    features: [
      "12 sessions per month",
      "Premium training program",
      "Complete nutrition coaching",
      "Priority 24/7 support",
      "Weekly progress review",
      "Body composition analysis",
      "Recovery protocols",
    ],
    popular: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="py-20 lg:py-32 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-primary font-semibold tracking-wider uppercase text-sm mb-2">
            Pricing
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-balance">
            Investment in Your Health
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Choose the plan that fits your goals and schedule. All plans include 
            personalized attention and expert guidance.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.name}
              className={`bg-background border-border relative ${
                tier.popular ? "border-primary ring-1 ring-primary" : ""
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">{tier.period}</span>
                </div>
                <CardDescription className="mt-2">{tier.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <button
                  className="w-full"
                >
                  <Link href="#booking">Get Started</Link>
                </button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
