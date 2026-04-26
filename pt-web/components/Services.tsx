import { Dumbbell, Heart, Apple, Users, Timer, Brain } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card"

const services = [
  {
    icon: Dumbbell,
    title: "Strength Training",
    description: "Build muscle, increase strength, and sculpt your physique with progressive resistance training programs.",
  },
  {
    icon: Heart,
    title: "Cardio Conditioning",
    description: "Improve your cardiovascular health and endurance with HIIT, steady-state cardio, and functional training.",
  },
  {
    icon: Apple,
    title: "Nutrition Coaching",
    description: "Fuel your body right with personalized meal plans and nutritional guidance tailored to your goals.",
  },
  {
    icon: Users,
    title: "Group Training",
    description: "Train with others in small group sessions that combine motivation, accountability, and fun.",
  },
  {
    icon: Timer,
    title: "Online Coaching",
    description: "Get expert guidance anywhere with customized online programs, video check-ins, and 24/7 support.",
  },
  {
    icon: Brain,
    title: "Lifestyle Coaching",
    description: "Transform your mindset and habits for long-term success with holistic wellness guidance.",
  },
]

export function Services() {
  return (
    <section id="services" className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-primary font-semibold tracking-wider uppercase text-sm mb-2">
            Services
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-balance">
            Comprehensive Fitness Solutions
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            From personalized one-on-one training to nutrition guidance, I offer 
            a complete suite of services to support your fitness journey.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <Card key={service.title} className="bg-card border-border hover:border-primary/50 transition-colors group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{service.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  {service.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
