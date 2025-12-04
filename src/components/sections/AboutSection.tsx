import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const benefits = [
  "Скорочення операційних витрат до 40%",
  "Підвищення продуктивності на 60%",
  "Зменшення харчових відходів на 30%",
  "Відповідність міжнародним стандартам",
];

const AboutSection = () => {
  return (
    <section id="about" className="py-20 md:py-32 bg-secondary/30 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <div>
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              Про лабораторію
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Ми створюємо <span className="text-gradient">майбутнє</span> харчової індустрії
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Foodtech Automation Lab — це команда експертів з автоматизації, data science та харчових технологій. 
              Ми допомагаємо підприємствам впроваджувати інноваційні рішення для підвищення ефективності та якості виробництва.
            </p>

            <ul className="space-y-4 mb-8">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-3 text-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <Button variant="hero" size="lg">
              Дізнатись більше
            </Button>
          </div>

          {/* Right Content - Visual */}
          <div className="relative">
            <div className="relative aspect-square max-w-lg mx-auto">
              {/* Main Circle */}
              <div className="absolute inset-0 rounded-full gradient-primary opacity-10" />
              
              {/* Inner Content */}
              <div className="absolute inset-8 rounded-full bg-card border border-border shadow-card flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="text-6xl md:text-7xl font-bold text-gradient mb-2">10+</div>
                  <div className="text-lg text-muted-foreground">років досвіду</div>
                </div>
              </div>

              {/* Floating Elements */}
              <div className="absolute top-4 right-8 w-20 h-20 rounded-xl bg-card border border-border shadow-card flex items-center justify-center animate-float">
                <span className="text-2xl">🏭</span>
              </div>
              <div className="absolute bottom-8 left-4 w-20 h-20 rounded-xl bg-card border border-border shadow-card flex items-center justify-center animate-float" style={{ animationDelay: "1s" }}>
                <span className="text-2xl">🤖</span>
              </div>
              <div className="absolute top-1/2 -left-4 w-16 h-16 rounded-xl bg-card border border-border shadow-card flex items-center justify-center animate-float" style={{ animationDelay: "2s" }}>
                <span className="text-xl">📊</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
