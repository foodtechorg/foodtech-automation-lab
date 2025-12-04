import { Bot, LineChart, Shield, Zap, Settings, Leaf } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Автоматизація процесів",
    description: "Роботизовані системи для пакування, сортування та обробки продуктів з AI-керуванням",
  },
  {
    icon: LineChart,
    title: "Аналітика в реальному часі",
    description: "Моніторинг KPI виробництва, прогнозування попиту та оптимізація запасів",
  },
  {
    icon: Shield,
    title: "Контроль якості",
    description: "Комп'ютерний зір для виявлення дефектів та забезпечення стандартів HACCP",
  },
  {
    icon: Zap,
    title: "IoT сенсори",
    description: "Мережа датчиків температури, вологості та тиску для контролю умов зберігання",
  },
  {
    icon: Settings,
    title: "ERP інтеграція",
    description: "Безшовна інтеграція з SAP, 1C та іншими системами управління підприємством",
  },
  {
    icon: Leaf,
    title: "Сталий розвиток",
    description: "Рішення для зменшення харчових відходів та оптимізації енергоспоживання",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 md:py-32 bg-background relative">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Наші рішення
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
            Комплексна <span className="text-gradient">автоматизація</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Від виробництва до доставки — повний цикл цифрової трансформації вашого бізнесу
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 md:p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-500 hover:shadow-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
