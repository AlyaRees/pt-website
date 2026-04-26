import { Star, Quote } from "lucide-react"
import { Card, CardContent } from "./ui/Card"

const testimonials = [
  {
    name: "Sarah Mitchell",
    role: "Lost 45 lbs in 6 months",
    content: "Alex completely transformed my approach to fitness. The personalized attention and support helped me achieve results I never thought possible. I'm stronger, healthier, and more confident than ever.",
    rating: 5,
  },
  {
    name: "Marcus Johnson",
    role: "Gained 20 lbs of muscle",
    content: "Working with Alex has been a game-changer. His knowledge of strength training and nutrition is incredible. I've put on serious muscle while staying lean. Highly recommend!",
    rating: 5,
  },
  {
    name: "Emily Chen",
    role: "Marathon finisher",
    content: "From barely running a mile to completing my first marathon - Alex made it happen. The training program was challenging but achievable. Best investment in my health ever.",
    rating: 5,
  },
  {
    name: "David Thompson",
    role: "Business executive",
    content: "As a busy professional, I needed efficient workouts that deliver results. Alex designed a program that fits my schedule perfectly. More energy, better focus, and in the best shape of my life at 50.",
    rating: 5,
  },
  {
    name: "Jessica Williams",
    role: "New mom",
    content: "After pregnancy, I struggled to get back in shape. Alex's postpartum fitness program was exactly what I needed - safe, effective, and understanding of my limitations. Feeling stronger every day!",
    rating: 5,
  },
  {
    name: "Robert Garcia",
    role: "Competition prep client",
    content: "Alex guided me through my first bodybuilding competition. His attention to detail during prep was unmatched. Placed top 3 in my first show thanks to his expertise.",
    rating: 5,
  },
]

export function Testimonials() {
  return (
    <section id="testimonials" className="py-20 lg:py-32 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-primary font-semibold tracking-wider uppercase text-sm mb-2">
            Testimonials
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-balance">
            Client Success Stories
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Real results from real people. See what clients have achieved through 
            dedicated training and expert guidance.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="bg-background border-border">
              <CardContent className="pt-6">
                <Quote className="h-8 w-8 text-primary/30 mb-4" />
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  &ldquo;{testimonial.content}&rdquo;
                </p>
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-primary">{testimonial.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
