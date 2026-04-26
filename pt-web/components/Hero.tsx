import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,oklch(0.88_0.18_95/0.15),transparent_50%)]" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-primary font-semibold tracking-wider uppercase text-sm">
                Personal Training & Fitness Coaching
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-balance">
                Transform Your Body,{" "}
                <span className="text-primary">Elevate</span> Your Life
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                Achieve your fitness goals with personalized training programs, 
                expert guidance, and unwavering support. Your transformation starts here.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button className="text-base">
                <Link href="#booking">
                  Start Your Journey
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </button>
              <button className="text-base">
                <Link href="#services">View Services</Link>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-border">
              <div>
                <p className="text-3xl font-bold text-primary">10+</p>
                <p className="text-sm text-muted-foreground">Years Experience</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">500+</p>
                <p className="text-sm text-muted-foreground">Clients Transformed</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">98%</p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] rounded-lg bg-secondary overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-primary/30 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary" />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-6 left-6 right-6 bg-card/90 backdrop-blur-sm rounded-lg p-4 border border-border">
                <p className="font-semibold">Next Available Session</p>
                <p className="text-sm text-muted-foreground">Tomorrow, 9:00 AM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
