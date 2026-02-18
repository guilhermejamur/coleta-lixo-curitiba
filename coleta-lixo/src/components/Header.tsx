import { Leaf } from "lucide-react";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass shadow-soft">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/images/prefeitura-curitiba.png"
            alt="Prefeitura de Curitiba"
            className="h-12 w-auto"
          />
        </div>

        <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Leaf className="h-4 w-4 text-primary" />
          <span>Portal de Coleta</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-accent px-3 py-1.5">
            <span className="text-sm font-bold text-accent-foreground tracking-wide">ESTRE</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
