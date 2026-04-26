import Link from "next/link"
import { ArrowRight, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card"

const blogPosts = [
  {
    title: "5 Essential Compound Exercises for Total Body Strength",
    excerpt: "Discover the key movements that build functional strength and muscle mass efficiently.",
    date: "April 10, 2026",
    category: "Training",
    readTime: "5 min read",
  },
  {
    title: "Nutrition Timing: When to Eat for Optimal Performance",
    excerpt: "Learn how meal timing affects your energy levels, recovery, and workout performance.",
    date: "April 5, 2026",
    category: "Nutrition",
    readTime: "7 min read",
  },
  {
    title: "The Science of Recovery: Why Rest Days Matter",
    excerpt: "Understanding the importance of rest and recovery in your fitness journey.",
    date: "March 28, 2026",
    category: "Recovery",
    readTime: "6 min read",
  },
  {
    title: "Breaking Through Plateaus: Advanced Training Techniques",
    excerpt: "Strategies to overcome training stalls and continue making progress toward your goals.",
    date: "March 20, 2026",
    category: "Training",
    readTime: "8 min read",
  },
]

export function Blog() {
  return (
    <section id="blog" className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="text-primary font-semibold tracking-wider uppercase text-sm mb-2">
              Blog
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-balance">
              Fitness Tips & Insights
            </h2>
          </div>
          <button className="w-fit">
            <Link href="#">
              View All Posts
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {blogPosts.map((post) => (
            <Card key={post.title} className="bg-card border-border hover:border-primary/50 transition-colors group cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                    {post.category}
                  </span>
                  <span className="text-xs text-muted-foreground">{post.readTime}</span>
                </div>
                <CardTitle className="text-lg leading-snug group-hover:text-primary transition-colors">
                  {post.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="text-muted-foreground line-clamp-2">
                  {post.excerpt}
                </CardDescription>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {post.date}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
