import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Phone } from "lucide-react";

const CTASection = () => {
  return (
    <section id="contact" className="py-20 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-dark" />
      
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-10 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center px-4 py-2 rounded-full bg-primary/20 text-primary text-sm font-medium mb-6">
            Готові розпочати?
          </span>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
            Трансформуйте ваше виробництво сьогодні
          </h2>
          
          <p className="text-lg md:text-xl text-primary-foreground/70 mb-10 max-w-2xl mx-auto">
            Отримайте безкоштовну консультацію та аудит вашого підприємства від наших експертів
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button variant="accent" size="xl">
              Замовити дзвінок
              <ArrowRight className="ml-2" />
            </Button>
            <Button 
              variant="outline" 
              size="xl" 
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              Завантажити презентацію
            </Button>
          </div>

          {/* Contact Info */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 md:gap-10">
            <a 
              href="mailto:info@foodtech-lab.ua" 
              className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary transition-colors"
            >
              <Mail className="w-5 h-5" />
              <span>info@foodtech-lab.ua</span>
            </a>
            <a 
              href="tel:+380441234567" 
              className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary transition-colors"
            >
              <Phone className="w-5 h-5" />
              <span>+38 (044) 123-45-67</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
