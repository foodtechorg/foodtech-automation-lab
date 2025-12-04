const Footer = () => {
  const currentYear = new Date().getFullYear();

  const links = {
    solutions: [
      { label: "Автоматизація", href: "#" },
      { label: "Аналітика", href: "#" },
      { label: "IoT рішення", href: "#" },
      { label: "Контроль якості", href: "#" },
    ],
    company: [
      { label: "Про нас", href: "#about" },
      { label: "Команда", href: "#" },
      { label: "Кар'єра", href: "#" },
      { label: "Блог", href: "#" },
    ],
    support: [
      { label: "Документація", href: "#" },
      { label: "FAQ", href: "#" },
      { label: "Контакти", href: "#contact" },
      { label: "Підтримка", href: "#" },
    ],
  };

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">F</span>
              </div>
              <span className="font-bold text-lg text-foreground">
                Foodtech <span className="text-primary">Lab</span>
              </span>
            </a>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Інноваційні рішення для автоматизації харчової промисловості
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Рішення</h4>
            <ul className="space-y-2">
              {links.solutions.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-muted-foreground hover:text-primary text-sm transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Компанія</h4>
            <ul className="space-y-2">
              {links.company.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-muted-foreground hover:text-primary text-sm transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Підтримка</h4>
            <ul className="space-y-2">
              {links.support.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-muted-foreground hover:text-primary text-sm transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            © {currentYear} Foodtech Automation Lab. Всі права захищено.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">
              Політика конфіденційності
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">
              Умови використання
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
