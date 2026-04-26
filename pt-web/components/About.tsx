import { Award, Target, Users, Zap } from "lucide-react"

const highlights = [
  {
    icon: Award,
    title: "Certified Expert",
    description: "NASM, ACE & CrossFit Level 2 certified trainer",
  },
  {
    icon: Target,
    title: "Goal-Oriented",
    description: "Customized programs tailored to your objectives",
  },
  {
    icon: Users,
    title: "Community Focused",
    description: "Building a supportive fitness community",
  },
  {
    icon: Zap,
    title: "Results Driven",
    description: "Proven methods that deliver real results",
  },
]

export function About() {
  return (
    <section id="about" className="py-20 lg:py-32 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-6">
            <div>
              <p className="text-primary font-semibold tracking-wider uppercase text-sm mb-2">
                About Me
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-balance">
                Your Partner in Fitness Excellence
              </h2>
            </div>

            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Hi, I&apos;m Alex Carter. With over a decade of experience in personal 
                training and fitness coaching, I&apos;ve dedicated my career to helping 
                individuals transform their bodies and lives through sustainable 
                fitness practices.
              </p>
              <p>
                My approach combines scientific training methods with personalized 
                attention, ensuring every client receives a program tailored to their 
                unique goals, fitness level, and lifestyle. Whether you&apos;re looking 
                to build muscle, lose weight, or improve your overall health, I&apos;m 
                here to guide you every step of the way.
              </p>
              <p>
                I believe fitness should be accessible, enjoyable, and sustainable. 
                That&apos;s why I focus on building long-term habits rather than quick 
                fixes, helping you achieve results that last a lifetime.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="bg-background rounded-lg p-6 border border-border hover:border-primary/50 transition-colors"
              >
                <item.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
