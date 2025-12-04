import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen gradient-hero overflow-hidden pt-20">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:60px_60px] opacity-30" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] text-center">
          {/* Badge */}
          <div className="animate-fade-up mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Інновації в харчовій індустрії
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-foreground max-w-5xl leading-tight animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Автоматизація для{" "}
            <span className="text-gradient">харчової</span>{" "}
            промисловості
          </h1>

          {/* Subheading */}
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl animate-fade-up" style={{ animationDelay: "0.2s" }}>
            Розумні рішення для оптимізації виробництва, контролю якості та управління ланцюгами постачання в харчовій галузі
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-10 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Button variant="hero" size="xl">
              Безкоштовна консультація
              <ArrowRight className="ml-2" />
            </Button>
            <Button variant="outline" size="xl">
              <Play className="mr-2" size={18} />
              Дивитись відео
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 md:mt-20 animate-fade-up" style={{ animationDelay: "0.4s" }}>
            {[
              { value: "150+", label: "Підприємств" },
              { value: "40%", label: "Зниження витрат" },
              { value: "99.9%", label: "Точність" },
              { value: "24/7", label: "Підтримка" },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm md:text-base text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default HeroSection;
